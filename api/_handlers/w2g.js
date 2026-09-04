import { getJwtSecret } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { attachClanBadges, getUserClanId } from '../_lib/clan.js';

// redis singleton from _lib/redis.js

const MAX_CHAT_MESSAGES = 200;
const MEMBER_TIMEOUT_MS = 12 * 1000; // 12 detik tidak heartbeat = offline (members langsung dibersihkan)
const ROOM_TTL_SEC = 24 * 60 * 60; // Room otomatis expired setelah 24 jam jika tidak aktif

const roomKey = (id) => `w2g:room:${id}`;
const membersKey = (id) => `w2g:members:${id}`;
const chatKey = (id) => `w2g:chat:${id}`;
const PUBLIC_ROOMS_KEY = 'w2g:public_rooms';

// Helper verifikasi user login atau guest dengan Stable/Persistent Guest ID
const getUserInfo = async (req) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  // Dapatkan ID Guest yang stabil dari headers, body, query, atau cookie
  const guestId =
    req.headers['x-guest-id'] ||
    req.body?.guestId ||
    req.query?.guestId ||
    cookies.w2g_guest_id ||
    'guest_' + (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const guestName = req.headers['x-guest-name'] || req.body?.guestName || req.query?.guestName || 'Penonton Tamu';

  if (!token) {
    return {
      id: guestId,
      name: guestName,
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      frame: null,
      level: 1,
      title: 'Tamu',
      isGuest: true,
      clanBadge: null
    };
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const raw = await redis.get(`user:${decoded.userId}`);
    if (!raw) {
      return {
        id: decoded.userId,
        name: 'User',
        picture: null,
        frame: null,
        level: 1,
        title: 'Anime Newbie',
        isGuest: false,
        clanBadge: null
      };
    }
    const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
    let clanBadge = null;
    try {
      const clanId = await getUserClanId(decoded.userId);
      if (clanId) {
        const clanRaw = await redis.get(`clan:${clanId}`);
        if (clanRaw) {
          const clan = typeof clanRaw === 'string' ? JSON.parse(clanRaw) : clanRaw;
          clanBadge = clan.name || null;
        }
      }
    } catch {}

    return {
      id: decoded.userId,
      name: u.name || 'User',
      picture: u.picture || null,
      frame: u.frame || null,
      level: u.level || 0,
      title: u.title || 'Anime Newbie',
      isGuest: false,
      clanBadge
    };
  } catch {
    return {
      id: guestId,
      name: guestName,
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      frame: null,
      level: 1,
      title: 'Tamu',
      isGuest: true,
      clanBadge: null
    };
  }
};

// Generate kode room 6 karakter yang mudah diingat
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req, res) {
  const action = req.query.action || '';

  // ===== 1. GET /api/v1/w2g/rooms (Daftar Room Publik Aktif) =====
  if (action === 'rooms') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const roomIds = await redis.smembers(PUBLIC_ROOMS_KEY);
      if (!roomIds || roomIds.length === 0) {
        return res.json({ success: true, rooms: [] });
      }

      const rooms = [];
      const now = Date.now();

      for (const rid of roomIds) {
        const rRaw = await redis.get(roomKey(rid));
        if (!rRaw) {
          // Cleanup stale room id
          await redis.srem(PUBLIC_ROOMS_KEY, rid);
          continue;
        }
        const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;

        // Ambil member aktif
        const membersMap = await redis.hgetall(membersKey(rid));
        let activeCount = 0;
        if (membersMap) {
          for (const mStr of Object.values(membersMap)) {
            try {
              const m = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
              if (now - m.lastSeen < MEMBER_TIMEOUT_MS) {
                activeCount++;
              }
            } catch {}
          }
        }

        // Jika room kosong > 15 menit, hapus dari list
        if (activeCount === 0 && now - (room.updatedAt || room.createdAt) > 15 * 60 * 1000) {
          await redis.srem(PUBLIC_ROOMS_KEY, rid);
          continue;
        }

        rooms.push({
          id: room.id,
          title: room.title,
          animeTitle: room.animeTitle,
          animePoster: room.animePoster,
          episodeIndex: room.episodeIndex,
          hostName: room.hostName,
          hostAvatar: room.hostAvatar,
          hasPasscode: !!room.passcode,
          activeCount: Math.max(1, activeCount),
          isPlaying: room.isPlaying,
          createdAt: room.createdAt
        });
      }

      // Urutkan dari member terbanyak / terbaru
      rooms.sort((a, b) => b.activeCount - a.activeCount || b.createdAt - a.createdAt);

      return res.json({ success: true, rooms });
    } catch (e) {
      console.error('W2G rooms error:', e);
      return res.status(500).json({ error: 'Gagal memuat daftar room' });
    }
  }

  // ===== 2. POST /api/v1/w2g/create (Buat Room Baru) =====
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const {
        title,
        animeId,
        animeSlug,
        animeTitle,
        animePoster,
        episodeIndex,
        episodeId,
        videoUrl,
        videoQuality = '720p',
        isPublic = true,
        passcode = '',
        maxMembers = 25
      } = req.body || {};

      if (!title?.trim()) {
        return res.status(400).json({ error: 'Nama room wajib diisi' });
      }

      const roomId = generateRoomCode();
      const now = Date.now();

      const newRoom = {
        id: roomId,
        title: title.trim().slice(0, 50),
        animeId: animeId || null,
        animeSlug: animeSlug || null,
        animeTitle: animeTitle || 'Video Bersama',
        animePoster: animePoster || '/img/welcomebanner.webp',
        episodeIndex: episodeIndex ? String(episodeIndex) : '1',
        episodeId: episodeId || null,
        videoUrl: (videoUrl || '').replace('action=proxy', 'action=stream'),
        videoQuality,
        creatorId: user.id, // ID Pembuat Room Asli (Owner)
        creatorName: user.name,
        creatorAvatar: user.picture,
        hostId: user.id, // Host Aktif
        hostName: user.name,
        hostAvatar: user.picture,
        isPlaying: false,
        currentTime: 0,
        updatedAt: now,
        isPublic: Boolean(isPublic),
        passcode: passcode ? String(passcode).trim() : '',
        maxMembers: Math.min(50, Math.max(2, parseInt(maxMembers) || 25)),
        createdAt: now
      };

      // Simpan room
      await redis.set(roomKey(roomId), JSON.stringify(newRoom), { ex: ROOM_TTL_SEC });

      // Daftarkan host ke members
      const hostMember = {
        userId: user.id,
        name: user.name,
        avatar: user.picture,
        frame: user.frame,
        level: user.level,
        title: user.title,
        clanBadge: user.clanBadge,
        role: 'host',
        lastSeen: now
      };
      await redis.hset(membersKey(roomId), { [user.id]: JSON.stringify(hostMember) });
      await redis.expire(membersKey(roomId), ROOM_TTL_SEC);

      // Welcome message in chat
      const welcomeMsg = {
        id: `msg_${now}`,
        seq: 1,
        userId: 'system',
        userName: 'Sistem W2G',
        userAvatar: '/img/kaguya.webp',
        clanBadge: null,
        text: `Room "${newRoom.title}" dibuat oleh ${user.name}. Selamat menonton bareng!`,
        color: '#d4a73c',
        isDanmaku: false,
        videoTime: 0,
        timestamp: now
      };
      await redis.rpush(chatKey(roomId), JSON.stringify(welcomeMsg));
      await redis.expire(chatKey(roomId), ROOM_TTL_SEC);

      if (newRoom.isPublic) {
        await redis.sadd(PUBLIC_ROOMS_KEY, roomId);
      }

      return res.json({ success: true, roomId, room: newRoom });
    } catch (e) {
      console.error('W2G create error:', e);
      return res.status(500).json({ error: 'Gagal membuat room' });
    }
  }

  // ===== 3. GET /api/v1/w2g/room (Ambil Data Room & Join) =====
  if (action === 'room') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const roomId = (req.query.id || '').toUpperCase().trim();
      const passcode = req.query.passcode || '';
      const user = await getUserInfo(req);

      if (!roomId) return res.status(400).json({ error: 'ID Room tidak valid' });

      const rRaw = await redis.get(roomKey(roomId));
      if (!rRaw) return res.status(404).json({ error: 'Room tidak ditemukan atau sudah ditutup' });

      const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;

      // Cek passcode jika ada dan user bukan host
      if (room.passcode && room.hostId !== user.id && room.passcode !== passcode) {
        return res.status(403).json({ error: 'Passcode room salah', requiresPasscode: true });
      }

      const now = Date.now();

      // Cek apakah room sudah ditinggalkan (0 aktif) oleh host/pembuatnya
      const prevMembersMap = await redis.hgetall(membersKey(roomId));
      let activeViewerCount = 0;
      if (prevMembersMap) {
        for (const mStr of Object.values(prevMembersMap)) {
          try {
            const m = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
            if (now - m.lastSeen < MEMBER_TIMEOUT_MS) activeViewerCount++;
          } catch {}
        }
      }

      const creatorId = room.creatorId || room.hostId;
      const isCreator = user.id === creatorId;

      // Jika room kosong (0 penonton aktif) dan ditinggalkan > 2 menit, hapus room permanen
      if (activeViewerCount === 0 && !isCreator && (now - (room.updatedAt || room.createdAt) > 2 * 60 * 1000)) {
        await Promise.all([
          redis.del(roomKey(roomId)),
          redis.del(membersKey(roomId)),
          redis.del(chatKey(roomId)),
          redis.srem(PUBLIC_ROOMS_KEY, roomId)
        ]);
        return res.status(404).json({ error: 'Room telah ditutup atau sudah tidak aktif' });
      }

      // Tambahkan/Update user ke daftar member
      const memberObj = {
        userId: user.id,
        name: user.name,
        avatar: user.picture,
        frame: user.frame,
        level: user.level,
        title: user.title,
        clanBadge: user.clanBadge,
        role: user.id === room.hostId ? 'host' : 'member',
        lastSeen: now
      };
      await redis.hset(membersKey(roomId), { [user.id]: JSON.stringify(memberObj) });

      // Ambil seluruh member aktif & bersihkan yang offline/expired
      const membersMap = await redis.hgetall(membersKey(roomId));
      const activeMembers = [];
      const seenIds = new Set();
      if (membersMap) {
        for (const [mId, mStr] of Object.entries(membersMap)) {
          try {
            const m = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
            if (now - m.lastSeen < MEMBER_TIMEOUT_MS) {
              if (!seenIds.has(m.userId)) {
                seenIds.add(m.userId);
                activeMembers.push(m);
              }
            } else {
              await redis.hdel(membersKey(roomId), mId);
            }
          } catch {
            await redis.hdel(membersKey(roomId), mId);
          }
        }
      }

      // Ambil 50 chat terakhir
      const chatRaw = await redis.lrange(chatKey(roomId), -50, -1);
      const chatMessages = (chatRaw || []).map((c) => (typeof c === 'string' ? JSON.parse(c) : c));

      // Estimasi currentTime jika sedang playing
      let currentPlaybackTime = room.currentTime || 0;
      if (room.isPlaying && room.updatedAt) {
        const elapsedSec = (now - room.updatedAt) / 1000;
        currentPlaybackTime += elapsedSec;
      }

      // AFK Host Migration & Creator Reclaim Logic
      let roomModified = false;

      if (isCreator && room.hostId !== creatorId) {
        // Creator kembali ke room -> Kembalikan status host ke Creator!
        room.hostId = user.id;
        room.hostName = user.name;
        room.hostAvatar = user.picture;
        roomModified = true;

        const sysMsg = {
          id: `msg_${now}`,
          seq: ((await redis.llen(chatKey(roomId))) || 0) + 1,
          userId: 'system',
          userName: 'Sistem W2G',
          userAvatar: '/img/kaguya.webp',
          clanBadge: null,
          text: `Pembuat Room (${user.name}) telah kembali dan mengambil alih kontrol room.`,
          color: '#d4a73c',
          isDanmaku: false,
          videoTime: currentPlaybackTime,
          timestamp: now
        };
        await redis.rpush(chatKey(roomId), JSON.stringify(sysMsg));
      } else {
        // Cek apakah host aktif saat ini sedang online
        const isHostOnline = activeMembers.some((m) => m.userId === room.hostId);
        if (!isHostOnline && activeMembers.length > 0) {
          const nextHost = activeMembers.find((m) => m.userId === creatorId) || activeMembers[0];
          if (nextHost && room.hostId !== nextHost.userId) {
            room.hostId = nextHost.userId;
            room.hostName = nextHost.name;
            room.hostAvatar = nextHost.avatar;
            roomModified = true;

            const sysMsg = {
              id: `msg_${now}`,
              seq: ((await redis.llen(chatKey(roomId))) || 0) + 1,
              userId: 'system',
              userName: 'Sistem W2G',
              userAvatar: '/img/kaguya.webp',
              clanBadge: null,
              text: `Host sebelumnya sedang AFK/Offline. Kontrol host dialihkan sementara ke ${nextHost.name}.`,
              color: '#d4a73c',
              isDanmaku: false,
              videoTime: currentPlaybackTime,
              timestamp: now
            };
            await redis.rpush(chatKey(roomId), JSON.stringify(sysMsg));
          }
        }
      }

      if (roomModified) {
        await redis.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });
      }

      const formattedMembers = activeMembers.map((m) => ({
        ...m,
        role: m.userId === room.hostId ? 'host' : 'member',
        isCreator: m.userId === (room.creatorId || room.hostId)
      }));

      return res.json({
        success: true,
        room: {
          ...room,
          passcode: undefined, // jangan kirim raw passcode ke client
          hasPasscode: !!room.passcode,
          estimatedTime: currentPlaybackTime
        },
        isHost: user.id === room.hostId,
        currentUser: user,
        members: formattedMembers,
        chat: chatMessages
      });
    } catch (e) {
      console.error('W2G room detail error:', e);
      return res.status(500).json({ error: 'Gagal memuat room' });
    }
  }

  // ===== 4. POST /api/v1/w2g/sync (Host Update Play/Pause/Seek) =====
  if (action === 'sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId, isPlaying, currentTime, videoUrl, episodeIndex, episodeId } = req.body || {};

      if (!roomId) return res.status(400).json({ error: 'Room ID wajib' });

      const rRaw = await redis.get(roomKey(roomId));
      if (!rRaw) return res.status(404).json({ error: 'Room tidak ditemukan' });
      const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;

      const isCreator = user.id === (room.creatorId || room.hostId);
      if (room.hostId !== user.id && !isCreator) {
        return res.status(403).json({ error: 'Hanya host yang dapat mengontrol sinkronisasi' });
      }
      if (isCreator && room.hostId !== user.id) {
        room.hostId = user.id;
        room.hostName = user.name;
        room.hostAvatar = user.picture;
      }

      const now = Date.now();
      room.isPlaying = Boolean(isPlaying);
      const targetTime = parseFloat(currentTime);
      if (!isNaN(targetTime)) {
        room.currentTime = Math.max(0, targetTime);
      }
      room.updatedAt = now;
      if (videoUrl) room.videoUrl = videoUrl.replace('action=proxy', 'action=stream');
      if (episodeIndex) room.episodeIndex = String(episodeIndex);
      if (episodeId) room.episodeId = episodeId;

      await redis.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });

      return res.json({ success: true, room });
    } catch (e) {
      console.error('W2G sync error:', e);
      return res.status(500).json({ error: 'Gagal sinkronisasi' });
    }
  }

  // ===== 5. POST /api/v1/w2g/heartbeat (Sync Polling & Presence) =====
  if (action === 'heartbeat') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId, lastSeq = 0, userCurrentTime = 0 } = req.body || {};

      if (!roomId) return res.status(400).json({ error: 'Room ID wajib' });

      const rRaw = await redis.get(roomKey(roomId));
      if (!rRaw) return res.status(404).json({ error: 'Room telah ditutup' });
      const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;

      const now = Date.now();

      // Update lastSeen member
      const memberObj = {
        userId: user.id,
        name: user.name,
        avatar: user.picture,
        frame: user.frame,
        level: user.level,
        title: user.title,
        clanBadge: user.clanBadge,
        role: user.id === room.hostId ? 'host' : 'member',
        lastSeen: now
      };
      await redis.hset(membersKey(roomId), { [user.id]: JSON.stringify(memberObj) });

      // Ambil seluruh member aktif & bersihkan yang offline/expired
      const membersMap = await redis.hgetall(membersKey(roomId));
      const activeMembers = [];
      const seenIds = new Set();
      if (membersMap) {
        for (const [mId, mStr] of Object.entries(membersMap)) {
          try {
            const m = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
            if (now - m.lastSeen < MEMBER_TIMEOUT_MS) {
              if (!seenIds.has(m.userId)) {
                seenIds.add(m.userId);
                activeMembers.push(m);
              }
            } else {
              // Hapus member yang sudah offline
              await redis.hdel(membersKey(roomId), mId);
            }
          } catch {
            await redis.hdel(membersKey(roomId), mId);
          }
        }
      }

      // Hitung playback time estimasi host
      let estimatedHostTime = room.currentTime || 0;
      if (room.isPlaying && room.updatedAt) {
        const elapsedSec = (now - room.updatedAt) / 1000;
        estimatedHostTime += elapsedSec;
      }

      // AFK Host Migration & Creator Reclaim in Heartbeat
      let roomModified = false;
      const creatorId = room.creatorId || room.hostId;
      const isCreator = user.id === creatorId;

      if (isCreator && room.hostId !== creatorId) {
        room.hostId = user.id;
        room.hostName = user.name;
        room.hostAvatar = user.picture;
        roomModified = true;
      } else {
        const isHostOnline = activeMembers.some((m) => m.userId === room.hostId);
        if (!isHostOnline && activeMembers.length > 0) {
          const nextHost = activeMembers.find((m) => m.userId === creatorId) || activeMembers[0];
          if (nextHost && room.hostId !== nextHost.userId) {
            room.hostId = nextHost.userId;
            room.hostName = nextHost.name;
            room.hostAvatar = nextHost.avatar;
            roomModified = true;
          }
        }
      }

      // Jika user adalah host yang sedang memutar video (dan tidak paused), simpan checkpoint time secara berkala
      if (user.id === room.hostId && userCurrentTime > 0 && room.isPlaying) {
        room.currentTime = userCurrentTime;
        room.updatedAt = now;
        roomModified = true;
      }

      if (roomModified) {
        await redis.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });
      }

      // Ambil chat baru jika lastSeq < total chat
      const chatRaw = await redis.lrange(chatKey(roomId), -30, -1);
      const allChat = (chatRaw || []).map((c) => (typeof c === 'string' ? JSON.parse(c) : c));
      const newChat = allChat.filter((c) => (c.seq || 0) > lastSeq);

      const formattedMembers = activeMembers.map((m) => ({
        ...m,
        role: m.userId === room.hostId ? 'host' : 'member',
        isCreator: m.userId === (room.creatorId || room.hostId)
      }));

      return res.json({
        success: true,
        playback: {
          isPlaying: room.isPlaying,
          currentTime: estimatedHostTime,
          hostUpdatedAt: room.updatedAt,
          videoUrl: room.videoUrl,
          episodeIndex: room.episodeIndex,
          episodeId: room.episodeId,
          animeTitle: room.animeTitle,
          animePoster: room.animePoster
        },
        members: formattedMembers,
        newChat,
        isHost: user.id === room.hostId
      });
    } catch (e) {
      console.error('W2G heartbeat error:', e);
      return res.status(500).json({ error: 'Heartbeat error' });
    }
  }

  // ===== 6. POST /api/v1/w2g/chat (Kirim Pesan & Danmaku) =====
  if (action === 'chat') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId, text, color = '#ffffff', isDanmaku = true, videoTime = 0 } = req.body || {};

      if (!roomId || !text?.trim()) {
        return res.status(400).json({ error: 'Pesan chat wajib diisi' });
      }

      const now = Date.now();
      const currentLen = (await redis.llen(chatKey(roomId))) || 0;
      const seq = currentLen + 1;

      const chatItem = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
        seq,
        userId: user.id,
        userName: user.name,
        userAvatar: user.picture,
        userFrame: user.frame,
        clanBadge: user.clanBadge,
        text: text.trim().slice(0, 200),
        color: color || '#ffffff',
        isDanmaku: Boolean(isDanmaku),
        videoTime: parseFloat(videoTime) || 0,
        timestamp: now
      };

      await redis.rpush(chatKey(roomId), JSON.stringify(chatItem));
      await redis.ltrim(chatKey(roomId), -MAX_CHAT_MESSAGES, -1);

      return res.json({ success: true, message: chatItem });
    } catch (e) {
      console.error('W2G chat error:', e);
      return res.status(500).json({ error: 'Gagal mengirim chat' });
    }
  }

  // ===== 7. POST /api/v1/w2g/change-video (Ganti Anime/Episode) =====
  if (action === 'change-video') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId, animeId, animeSlug, animeTitle, animePoster, episodeIndex, episodeId, videoUrl } = req.body || {};

      if (!roomId) return res.status(400).json({ error: 'Room ID wajib' });

      const rRaw = await redis.get(roomKey(roomId));
      if (!rRaw) return res.status(404).json({ error: 'Room tidak ditemukan' });
      const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;

      if (room.hostId !== user.id) {
        return res.status(403).json({ error: 'Hanya host yang dapat mengganti video' });
      }

      const now = Date.now();
      if (animeId) room.animeId = animeId;
      if (animeSlug) room.animeSlug = animeSlug;
      if (animeTitle) room.animeTitle = animeTitle;
      if (animePoster) room.animePoster = animePoster;
      if (episodeIndex) room.episodeIndex = String(episodeIndex);
      if (episodeId) room.episodeId = episodeId;
      if (videoUrl) room.videoUrl = videoUrl.replace('action=proxy', 'action=stream');
      room.currentTime = 0;
      room.isPlaying = true;
      room.updatedAt = now;

      await redis.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });

      // Kirim pesan sistem bahwa video diganti
      const sysMsg = {
        id: `msg_${now}`,
        seq: ((await redis.llen(chatKey(roomId))) || 0) + 1,
        userId: 'system',
        userName: 'Sistem W2G',
        userAvatar: '/img/kaguya.webp',
        clanBadge: null,
        text: `Host mengganti video ke: ${room.animeTitle} - Episode ${room.episodeIndex}`,
        color: '#ff4e2d',
        isDanmaku: false,
        videoTime: 0,
        timestamp: now
      };
      await redis.rpush(chatKey(roomId), JSON.stringify(sysMsg));

      return res.json({ success: true, room });
    } catch (e) {
      console.error('W2G change video error:', e);
      return res.status(500).json({ error: 'Gagal mengganti video' });
    }
  }

  // ===== 8. POST /api/v1/w2g/close (Tutup & Hapus Room Permanen oleh Host) =====
  if (action === 'close' || action === 'destroy') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId } = req.body || {};
      if (!roomId) return res.status(400).json({ error: 'Room ID wajib' });

      const rRaw = await redis.get(roomKey(roomId));
      if (rRaw) {
        const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;
        const isCreator = user.id === (room.creatorId || room.hostId);
        const isHost = user.id === room.hostId;
        if (!isCreator && !isHost) {
          return res.status(403).json({ error: 'Hanya host atau pembuat room yang dapat menutup room' });
        }
      }

      // Hapus seluruh data room dari Redis secara permanen
      await Promise.all([
        redis.del(roomKey(roomId)),
        redis.del(membersKey(roomId)),
        redis.del(chatKey(roomId)),
        redis.srem(PUBLIC_ROOMS_KEY, roomId)
      ]);

      return res.json({ success: true, message: 'Room berhasil ditutup dan dihapus' });
    } catch (e) {
      console.error('W2G close error:', e);
      return res.status(500).json({ error: 'Gagal menutup room' });
    }
  }

  // ===== 9. POST /api/v1/w2g/leave (Keluar Room & Cleanup jika Kosong) =====
  if (action === 'leave') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getUserInfo(req);
      const { roomId } = req.body || {};
      if (!roomId) return res.status(400).json({ error: 'Room ID wajib' });

      await redis.hdel(membersKey(roomId), user.id);

      // Cek sisa member aktif
      const now = Date.now();
      const membersMap = await redis.hgetall(membersKey(roomId));
      const activeIds = [];
      if (membersMap) {
        for (const [mId, mStr] of Object.entries(membersMap)) {
          try {
            const m = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
            if (now - m.lastSeen < MEMBER_TIMEOUT_MS) {
              activeIds.push(mId);
            }
          } catch {}
        }
      }

      const rRaw = await redis.get(roomKey(roomId));
      if (rRaw) {
        const room = typeof rRaw === 'string' ? JSON.parse(rRaw) : rRaw;
        const isCreator = user.id === (room.creatorId || room.hostId);

        // Jika room sudah tidak memiliki member aktif lain ATAU pembuat room keluar dan room kosong
        if (activeIds.length === 0) {
          await Promise.all([
            redis.del(roomKey(roomId)),
            redis.del(membersKey(roomId)),
            redis.del(chatKey(roomId)),
            redis.srem(PUBLIC_ROOMS_KEY, roomId)
          ]);
        } else if (room.hostId === user.id) {
          // Cari member aktif lain untuk diangkat jadi host baru
          const nextHostId = activeIds[0];
          const nextHost = JSON.parse(membersMap[nextHostId]);
          room.hostId = nextHost.userId;
          room.hostName = nextHost.name;
          room.hostAvatar = nextHost.avatar;
          nextHost.role = 'host';
          await redis.hset(membersKey(roomId), { [nextHostId]: JSON.stringify(nextHost) });
          await redis.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });
        }
      } else {
        await redis.srem(PUBLIC_ROOMS_KEY, roomId);
      }

      return res.json({ success: true });
    } catch (e) {
      console.error('W2G leave error:', e);
      return res.status(500).json({ error: 'Gagal keluar room' });
    }
  }

  return res.status(404).json({ error: `Aksi W2G tidak dikenali: ${action}` });
}
