import { verifyUserId } from '../_lib/auth.js';
// /api/v1/story/[...action].js
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

// Fitur Story & Catatan (Note) ala TikTok/Instagram.
//
// Redis keys:
//   story:{storyId}          -> STRING JSON {id,userId,type,text,bgColor,mediaUrl,createdAt}, EX 24 jam
//   story:user:{userId}      -> ZSET member=storyId, score=createdAt (buat urutan & rentang waktu aktif)
//   story:viewers:{storyId}  -> SET userId yang udah lihat story ini
//   note:{userId}            -> STRING JSON {text,createdAt}, EX 24 jam (cuma 1 catatan aktif per user)
//
// Story & catatan cuma dimunculkan dari user yang di-follow (+ punya sendiri),
// dipakai buat tray di halaman Pesan (kayak row story di atas kolom DM TikTok/IG).

// redis singleton from _lib/redis.js

const STORY_TTL_SEC = 24 * 60 * 60;
const STORY_TTL_MS = STORY_TTL_SEC * 1000;
const NOTE_TTL_SEC = 24 * 60 * 60;
const MAX_NOTE_LEN = 60;
const MAX_STORY_TEXT_LEN = 200;

const storyKey = (id) => `story:${id}`;
const userStoriesKey = (userId) => `story:user:${userId}`;
const viewersKey = (id) => `story:viewers:${id}`;
const noteKey = (userId) => `note:${userId}`;
const followingKey = (userId) => `following:${userId}`;

// verifyUserId imported from _lib/auth.js

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

const publicProfile = async (userId) => {
  const raw = await redis.get(`user:${userId}`);
  const u = safeParse(raw);
  if (!u) return null;
  return {
    id: userId,
    name: u.name || 'User',
    picture: u.picture || null,
    frame: u.frame || null
  };
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

  // 'user-stories' boleh diakses tanpa login / tanpa follow (ditampilkan di
  // halaman profil publik /user/:id). Semua action lain wajib login.
  if (!userId && action !== 'user-stories') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (action === 'create') {
    // ===== BUAT STORY BARU (foto, video, atau teks), aktif 24 jam =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const type = ['image', 'video'].includes(body?.type) ? body.type : 'text';
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_STORY_TEXT_LEN) : '';
      const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl.trim() : '';
      const bgColor = typeof body?.bgColor === 'string' ? body.bgColor.slice(0, 30) : '#d4a73c';

      if ((type === 'image' || type === 'video') && !mediaUrl) {
        return res.status(400).json({ error: `mediaUrl wajib diisi untuk story ${type === 'video' ? 'video' : 'foto'}` });
      }
      if (type === 'text' && !text) {
        return res.status(400).json({ error: 'Isi story tidak boleh kosong' });
      }

      const now = Date.now();
      const id = `story_${now}_${Math.random().toString(36).slice(2, 9)}`;
      const story = { id, userId, type, text, bgColor, mediaUrl: mediaUrl || null, createdAt: now };

      await redis.set(storyKey(id), JSON.stringify(story), { ex: STORY_TTL_SEC });

      // Bersihin story lama (di luar 24 jam) sebelum nambah yang baru, biar zset gak numpuk terus
      await redis.zremrangebyscore(userStoriesKey(userId), 0, now - STORY_TTL_MS);
      await redis.zadd(userStoriesKey(userId), { score: now, member: id });

      return res.json({ success: true, story });
    } catch (error) {
      console.error('Story create error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'feed') {
    // ===== TRAY STORY: daftar story aktif dari yang di-follow + diri sendiri =====
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const followingIds = await redis.smembers(followingKey(userId));
      const candidateIds = Array.from(new Set([userId, ...(followingIds || [])]));

      const now = Date.now();
      const minScore = now - STORY_TTL_MS;

      const entries = await Promise.all(candidateIds.map(async (uid) => {
        const [storyIds, noteRaw, profile] = await Promise.all([
          redis.zrange(userStoriesKey(uid), minScore, now, { byScore: true }),
          redis.get(noteKey(uid)),
          publicProfile(uid)
        ]);

        if (!profile) return null;

        let stories = [];
        if (storyIds && storyIds.length) {
          const raws = await redis.mget(...storyIds.map(storyKey));
          stories = raws.map(safeParse).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
        }

        const note = safeParse(noteRaw);

        if (stories.length === 0 && !note && uid !== userId) return null; // skip yg gak ada apa2, kecuali diri sendiri (buat tombol "+")

        let hasUnseen = false;
        if (stories.length && uid !== userId) {
          const seenChecks = await Promise.all(stories.map((s) => redis.sismember(viewersKey(s.id), userId)));
          hasUnseen = seenChecks.some((seen) => !seen);
        }

        return {
          user: profile,
          isSelf: uid === userId,
          stories: stories.map((s) => ({ id: s.id, type: s.type, text: s.text, bgColor: s.bgColor, mediaUrl: s.mediaUrl, createdAt: s.createdAt })),
          hasUnseen,
          note: note ? { text: note.text, createdAt: note.createdAt } : null
        };
      }));

      const list = entries.filter(Boolean);
      // Diri sendiri selalu pertama, sisanya: yang belum dilihat duluan, lalu terbaru
      list.sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
        const aLatest = a.stories.length ? a.stories[a.stories.length - 1].createdAt : 0;
        const bLatest = b.stories.length ? b.stories[b.stories.length - 1].createdAt : 0;
        return bLatest - aLatest;
      });

      return res.json({ success: true, feed: list });
    } catch (error) {
      console.error('Story feed error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'view') {
    // ===== TANDAI STORY SUDAH DILIHAT =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const storyId = body?.storyId;
      if (!storyId) return res.status(400).json({ error: 'storyId wajib diisi' });

      const raw = await redis.get(storyKey(storyId));
      const story = safeParse(raw);
      if (!story) return res.status(404).json({ error: 'Story tidak ditemukan atau sudah kedaluwarsa' });

      if (story.userId !== userId) {
        await redis.sadd(viewersKey(storyId), userId);
        await redis.expire(viewersKey(storyId), STORY_TTL_SEC);
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Story view error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'viewers') {
    // ===== LIHAT SIAPA AJA YANG NONTON STORY SENDIRI =====
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const storyId = req.query.storyId;
      if (!storyId) return res.status(400).json({ error: 'storyId wajib diisi' });

      const raw = await redis.get(storyKey(storyId));
      const story = safeParse(raw);
      if (!story) return res.status(404).json({ error: 'Story tidak ditemukan atau sudah kedaluwarsa' });
      if (story.userId !== userId) {
        return res.status(403).json({ error: 'Cuma pemilik story yang bisa lihat daftar penonton' });
      }

      const viewerIds = await redis.smembers(viewersKey(storyId));
      const profiles = await Promise.all((viewerIds || []).map(publicProfile));

      return res.json({ success: true, viewers: profiles.filter(Boolean) });
    } catch (error) {
      console.error('Story viewers error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'delete') {
    // ===== HAPUS STORY SENDIRI SEBELUM 24 JAM =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const storyId = body?.storyId;
      if (!storyId) return res.status(400).json({ error: 'storyId wajib diisi' });

      const raw = await redis.get(storyKey(storyId));
      const story = safeParse(raw);
      if (!story) return res.json({ success: true }); // udah kedaluwarsa/kehapus, anggap aja sukses
      if (story.userId !== userId) {
        return res.status(403).json({ error: 'Bukan story kamu' });
      }

      await redis.del(storyKey(storyId));
      await redis.zrem(userStoriesKey(userId), storyId);
      await redis.del(viewersKey(storyId));

      return res.json({ success: true });
    } catch (error) {
      console.error('Story delete error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'set-note') {
    // ===== TULIS / GANTI CATATAN (aktif 24 jam) =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text) return res.status(400).json({ error: 'Catatan tidak boleh kosong' });
      if (text.length > MAX_NOTE_LEN) {
        return res.status(400).json({ error: `Catatan maksimal ${MAX_NOTE_LEN} karakter` });
      }

      const note = { text, createdAt: Date.now() };
      await redis.set(noteKey(userId), JSON.stringify(note), { ex: NOTE_TTL_SEC });

      return res.json({ success: true, note });
    } catch (error) {
      console.error('Set note error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'delete-note') {
    // ===== HAPUS CATATAN SENDIRI =====
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      await redis.del(noteKey(userId));
      return res.json({ success: true });
    } catch (error) {
      console.error('Delete note error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'user-stories') {
    // ===== STORY + CATATAN MILIK 1 USER TERTENTU (buat halaman /user/:id) =====
    // Sengaja gak butuh follow ataupun login, biar story/catatan tetap
    // kelihatan pas buka profil publik seseorang.
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const targetId = req.query.userId;
      if (!targetId) return res.status(400).json({ error: 'userId wajib diisi' });

      const now = Date.now();
      const minScore = now - STORY_TTL_MS;

      const [storyIds, noteRaw] = await Promise.all([
        redis.zrange(userStoriesKey(targetId), minScore, now, { byScore: true }),
        redis.get(noteKey(targetId))
      ]);

      let stories = [];
      if (storyIds && storyIds.length) {
        const raws = await redis.mget(...storyIds.map(storyKey));
        stories = raws.map(safeParse).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
      }

      let hasUnseen = false;
      if (stories.length && userId && userId !== targetId) {
        const seenChecks = await Promise.all(stories.map((s) => redis.sismember(viewersKey(s.id), userId)));
        hasUnseen = seenChecks.some((seen) => !seen);
      } else if (stories.length && !userId) {
        hasUnseen = true; // tamu belum pernah "melihat" apa pun
      }

      const note = safeParse(noteRaw);

      return res.json({
        success: true,
        stories: stories.map((s) => ({ id: s.id, type: s.type, text: s.text, bgColor: s.bgColor, mediaUrl: s.mediaUrl, createdAt: s.createdAt })),
        hasUnseen,
        note: note ? { text: note.text, createdAt: note.createdAt } : null
      });
    } catch (error) {
      console.error('User-stories error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
}
