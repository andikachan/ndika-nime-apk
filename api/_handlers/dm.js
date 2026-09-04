import { verifyUserId } from '../_lib/auth.js';
// /api/v1/dm/[...action].js
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

// Chat pribadi antar user (1-on-1), lengkap dengan fitur streak harian
// (kayak Snapchat) dan share anime/komik ke dalam chat.
//
// Redis keys:
//   dm:messages:{convId}        -> LIST pesan (JSON), terbaru di depan (lpush)
//   dm:conv:{userId}            -> ZSET member=lawan bicara, score=waktu pesan terakhir
//   dm:lastread:{userId}:{other}-> STRING timestamp terakhir userId buka chat ini
//   dm:streak:{convId}          -> STRING JSON data streak (lihat DEFAULT_STREAK)
//
// convId dibuat deterministik dari 2 id yang diurutkan, jadi cuma ada 1
// percakapan per pasangan user, siapa pun yang mulai duluan.

// redis singleton from _lib/redis.js

const MAX_MESSAGES = 500;      // riwayat pesan yang disimpan per percakapan
const MESSAGES_PAGE_SIZE = 50;
const MAX_CONVERSATIONS = 30;  // percakapan yang ditampilkan di daftar inbox
const ONLINE_THRESHOLD_MS = 90 * 1000;
const MONTHLY_RESTORE_LIMIT = 6;
const STREAK_BREAK_AFTER_DAYS = 2; // "streak mati saat 2 hari gak di-restore"

const msgKey = (convId) => `dm:messages:${convId}`;
const convListKey = (userId) => `dm:conv:${userId}`;
const lastReadKey = (userId, otherId) => `dm:lastread:${userId}:${otherId}`;
const streakKey = (convId) => `dm:streak:${convId}`;
const lastSeenKey = (userId) => `lastSeen:${userId}`;

const makeConvId = (a, b) => [a, b].sort().join('_');

// verifyUserId imported from _lib/auth.js

const publicProfile = async (userId) => {
  const raw = await redis.get(`user:${userId}`);
  if (!raw) return null;
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    id: userId,
    name: u.name || 'User',
    picture: u.picture || null,
    frame: u.frame || null,
    level: u.level || 0,
    title: u.title || null
  };
};

const presenceOf = async (userId) => {
  const lastSeen = await redis.get(lastSeenKey(userId));
  const ts = lastSeen ? Number(lastSeen) : null;
  return { isOnline: !!ts && (Date.now() - ts) < ONLINE_THRESHOLD_MS, lastSeen: ts };
};

// ===== STREAK HELPERS =====

// Server Vercel jalan di UTC, user kita WIB (UTC+7, no DST) — setiap Date yang
// masuk sini digeser +7 jam dulu biar "hari ini"/"bulan ini" ngikutin WIB,
// bukan ganti tanggal jam 07:00 pagi WIB kayak sebelumnya.
const toWIB = (d) => new Date(d.getTime() + 7 * 60 * 60 * 1000);
const dateStr = (d = new Date()) => toWIB(d).toISOString().slice(0, 10); // 'YYYY-MM-DD' (WIB)
const monthKey = (d = new Date()) => toWIB(d).toISOString().slice(0, 7); // 'YYYY-MM' (WIB)
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

const DEFAULT_STREAK = () => ({
  count: 0,
  status: 'none', // 'none' | 'active' | 'broken'
  lastActiveByUser: {}, // { [userId]: 'YYYY-MM-DD' }
  lastCountedDate: null,
  brokenCount: 0,
  brokenAt: null,
  restoresUsed: 0,
  restoresMonth: null
});

const loadStreak = async (convId) => {
  const raw = await redis.get(streakKey(convId));
  if (!raw) return DEFAULT_STREAK();
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return { ...DEFAULT_STREAK(), ...parsed };
};

const saveStreak = async (convId, record) => {
  await redis.set(streakKey(convId), JSON.stringify(record));
};

// Kalau udah kelewat >= 2 hari sejak terakhir kali streak "kehitung" (kedua
// user chat di hari yang sama), streak-nya dianggap mati. Jumlah hari
// sebelum mati disimpan di brokenCount buat kemungkinan di-restore.
const applyBreakCheck = (record) => {
  if (record.status === 'active' && record.lastCountedDate) {
    const gap = daysBetween(record.lastCountedDate, dateStr());
    if (gap >= STREAK_BREAK_AFTER_DAYS) {
      record.status = 'broken';
      record.brokenCount = record.count;
      record.count = 0;
      record.brokenAt = Date.now();
    }
  }
  return record;
};

const resetMonthlyRestoreIfNeeded = (record) => {
  const mk = monthKey();
  if (record.restoresMonth !== mk) {
    record.restoresMonth = mk;
    record.restoresUsed = 0;
  }
  return record;
};

const sanitizeStreak = (record) => ({
  count: record.count,
  status: record.status,
  brokenCount: record.brokenCount,
  restoresUsed: record.restoresUsed,
  restoresLeft: Math.max(0, MONTHLY_RESTORE_LIMIT - record.restoresUsed)
});

// Dipanggil tiap kali ada pesan baru terkirim. Nyatet hari ini user ngirim
// pesan, dan kalau kedua user udah ngirim pesan di hari yang sama, streak
// nambah 1 (maksimal nambah sekali per hari).
const registerStreakActivity = async (convId, senderId, otherUserId) => {
  let record = await loadStreak(convId);
  record = applyBreakCheck(record);
  record = resetMonthlyRestoreIfNeeded(record);

  const today = dateStr();
  record.lastActiveByUser[senderId] = today;
  const otherLast = record.lastActiveByUser[otherUserId];

  if (otherLast === today && record.lastCountedDate !== today) {
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    if (record.status === 'active' && (record.lastCountedDate === yesterday || record.lastCountedDate === null)) {
      record.count += 1;
    } else {
      // Mulai fresh: baru pertama kali cocok, atau kemarin sempat putus & gak di-restore
      record.count = 1;
    }
    record.status = 'active';
    record.lastCountedDate = today;
  }

  await saveStreak(convId, record);
  return record;
};

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = verifyUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Kamu harus login dulu' });
  }

  if (action === 'conversations') {
    // ===== GET /api/v1/dm/conversations =====
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const raw = (await redis.zrange(convListKey(userId), 0, MAX_CONVERSATIONS - 1, { rev: true, withScores: true })) || [];

      const entries = [];
      for (let i = 0; i < raw.length; i += 2) {
        entries.push({ otherUserId: raw[i], lastMessageAt: Number(raw[i + 1]) });
      }

      const conversations = await Promise.all(entries.map(async ({ otherUserId, lastMessageAt }) => {
        const convId = makeConvId(userId, otherUserId);
        const [profile, lastMsgRaw, lastReadRaw, streakRecord, presence] = await Promise.all([
          publicProfile(otherUserId),
          redis.lrange(msgKey(convId), 0, 0),
          redis.get(lastReadKey(userId, otherUserId)),
          loadStreak(convId),
          presenceOf(otherUserId)
        ]);
        if (!profile) return null;

        const lastMessage = lastMsgRaw?.[0]
          ? (typeof lastMsgRaw[0] === 'string' ? JSON.parse(lastMsgRaw[0]) : lastMsgRaw[0])
          : null;
        const lastReadTs = lastReadRaw ? Number(lastReadRaw) : 0;

        return {
          user: profile,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen,
          lastMessage,
          lastMessageAt,
          unread: lastMessageAt > lastReadTs && lastMessage?.senderId !== userId,
          streak: sanitizeStreak(applyBreakCheck(streakRecord))
        };
      }));

      return res.json({ success: true, conversations: conversations.filter(Boolean) });
    } catch (error) {
      console.error('❌ List DM conversations error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'unread-count') {
    // ===== GET /api/v1/dm/unread-count =====
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const raw = (await redis.zrange(convListKey(userId), 0, MAX_CONVERSATIONS - 1, { rev: true, withScores: true })) || [];
      const entries = [];
      for (let i = 0; i < raw.length; i += 2) {
        entries.push({ otherUserId: raw[i], lastMessageAt: Number(raw[i + 1]) });
      }
      let unreadCount = 0;
      await Promise.all(entries.map(async ({ otherUserId, lastMessageAt }) => {
        const convId = makeConvId(userId, otherUserId);
        const [lastMsgRaw, lastReadRaw] = await Promise.all([
          redis.lrange(msgKey(convId), 0, 0),
          redis.get(lastReadKey(userId, otherUserId))
        ]);
        const lastMessage = lastMsgRaw?.[0]
          ? (typeof lastMsgRaw[0] === 'string' ? JSON.parse(lastMsgRaw[0]) : lastMsgRaw[0])
          : null;
        const lastReadTs = lastReadRaw ? Number(lastReadRaw) : 0;
        if (lastMessageAt > lastReadTs && lastMessage?.senderId !== userId) unreadCount += 1;
      }));
      return res.json({ success: true, unreadCount });
    } catch (error) {
      console.error('❌ DM unread count error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'messages') {
    // ===== GET /api/v1/dm/messages?userId=X =====
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const otherUserId = req.query.userId;
      if (!otherUserId) return res.status(400).json({ error: 'userId wajib diisi' });
      if (otherUserId === userId) return res.status(400).json({ error: 'Gak bisa chat sama diri sendiri' });

      const profile = await publicProfile(otherUserId);
      if (!profile) return res.status(404).json({ error: 'User tidak ditemukan' });

      const convId = makeConvId(userId, otherUserId);
      const [rawMessages, streakRecord, presence] = await Promise.all([
        redis.lrange(msgKey(convId), 0, MESSAGES_PAGE_SIZE - 1),
        loadStreak(convId),
        presenceOf(otherUserId)
      ]);

      const messages = rawMessages
        .map((m) => (typeof m === 'string' ? JSON.parse(m) : m))
        .reverse();

      const checkedStreak = applyBreakCheck(streakRecord);
      await saveStreak(convId, checkedStreak);

      // Tandai udah dibaca sampai sekarang
      await redis.set(lastReadKey(userId, otherUserId), Date.now());

      return res.json({
        success: true,
        otherUser: profile,
        isOnline: presence.isOnline,
        lastSeen: presence.lastSeen,
        messages,
        streak: sanitizeStreak(checkedStreak)
      });
    } catch (error) {
      console.error('❌ Load DM messages error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'send') {
    // ===== POST /api/v1/dm/send { targetUserId, text?, share? } =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const targetUserId = body?.targetUserId;
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      const share = body?.share;

      if (!targetUserId) return res.status(400).json({ error: 'targetUserId wajib diisi' });
      if (targetUserId === userId) return res.status(400).json({ error: 'Gak bisa chat sama diri sendiri' });
      if (!text && !share) return res.status(400).json({ error: 'Pesan gak boleh kosong' });

      const targetProfile = await publicProfile(targetUserId);
      if (!targetProfile) return res.status(404).json({ error: 'User tidak ditemukan' });

      let sharePayload = null;
      if (share && share.kind) {
        if (share.kind === 'anime' || share.kind === 'komik') {
          if (!share.slug) return res.status(400).json({ error: 'Data share gak lengkap' });
          sharePayload = {
            kind: share.kind,
            slug: String(share.slug).slice(0, 200),
            title: String(share.title || 'Untitled').slice(0, 200),
            cover: share.cover ? String(share.cover).slice(0, 500) : null,
            episode: share.episode ? String(share.episode).slice(0, 50) : null
          };
        } else if (share.kind === 'story') {
          // Balasan ke story — nyimpen snapshot kontennya sendiri (bukan cuma
          // referensi storyId) karena storynya bisa aja udah kedaluwarsa (24 jam)
          // pas pesannya masih ada di riwayat chat.
          sharePayload = {
            kind: 'story',
            storyType: ['image', 'video', 'text'].includes(share.storyType) ? share.storyType : 'text',
            text: share.text ? String(share.text).slice(0, 200) : '',
            bgColor: share.bgColor ? String(share.bgColor).slice(0, 30) : '#d4a73c',
            mediaUrl: share.mediaUrl ? String(share.mediaUrl).slice(0, 500) : null,
            ownerId: share.ownerId ? String(share.ownerId) : null,
            ownerName: share.ownerName ? String(share.ownerName).slice(0, 100) : null
          };
        } else if (share.kind === 'note') {
          sharePayload = {
            kind: 'note',
            text: share.text ? String(share.text).slice(0, 100) : '',
            ownerId: share.ownerId ? String(share.ownerId) : null,
            ownerName: share.ownerName ? String(share.ownerName).slice(0, 100) : null
          };
        } else {
          return res.status(400).json({ error: 'Tipe share gak valid' });
        }
      }

      const convId = makeConvId(userId, targetUserId);
      const now = Date.now();
      const message = {
        id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
        senderId: userId,
        type: sharePayload ? 'share' : 'text',
        text: text.slice(0, 2000),
        share: sharePayload,
        createdAt: now
      };

      await redis.lpush(msgKey(convId), JSON.stringify(message));
      const total = await redis.llen(msgKey(convId));
      if (total > MAX_MESSAGES) {
        await redis.ltrim(msgKey(convId), 0, MAX_MESSAGES - 1);
      }

      await Promise.all([
        redis.zadd(convListKey(userId), { score: now, member: targetUserId }),
        redis.zadd(convListKey(targetUserId), { score: now, member: userId }),
        redis.set(lastReadKey(userId, targetUserId), now) // pengirim otomatis "udah baca" sampai pesannya sendiri
      ]);

      const streak = await registerStreakActivity(convId, userId, targetUserId);

      return res.json({ success: true, message, streak: sanitizeStreak(streak) });
    } catch (error) {
      console.error('❌ Send DM error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'restore-streak') {
    // ===== POST /api/v1/dm/restore-streak { targetUserId } =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const targetUserId = body?.targetUserId;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId wajib diisi' });

      const convId = makeConvId(userId, targetUserId);
      let record = await loadStreak(convId);
      record = applyBreakCheck(record);
      record = resetMonthlyRestoreIfNeeded(record);

      if (record.status !== 'broken') {
        return res.status(400).json({ error: 'Streak ini gak lagi putus, gak perlu di-restore' });
      }
      if (record.restoresUsed >= MONTHLY_RESTORE_LIMIT) {
        return res.status(400).json({ error: 'Kesempatan restore bulan ini udah habis' });
      }

      record.count = record.brokenCount;
      record.status = 'active';
      // Kasih "kemarin" sebagai tanggal terakhir kehitung, jadi user masih
      // punya kesempatan hari ini buat lanjutin streaknya.
      record.lastCountedDate = dateStr(new Date(Date.now() - 86400000));
      record.brokenAt = null;
      record.restoresUsed += 1;

      await saveStreak(convId, record);

      return res.json({ success: true, streak: sanitizeStreak(record) });
    } catch (error) {
      console.error('❌ Restore streak error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(404).json({ error: 'Action tidak ditemukan' });
}
