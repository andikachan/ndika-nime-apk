import redis from '../_lib/redis.js';
import { getJwtSecret, verifyUserId } from '../_lib/auth.js';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getEmailSettings, saveEmailSettings, getTransporter } from '../_lib/mailer.js';
import {
  adminListClans, adminEditClan, adminSetMemberRole, adminKickMember,
  adminDisbandClan, adminGrantGachaItem, GACHA_POOL
} from '../_lib/clan.js';
import {
  getLastNotified, listExcludedEmails, addExcludedEmail, removeExcludedEmail
} from '../_lib/notify.js';
import {
  getTelegramSettings, saveTelegramSettings, getLastBackupInfo, setLastBackupInfo,
  buildFullBackup, restoreFromBackup, sendBackupToTelegram, wipeAllKeys
} from '../_lib/backup.js';

// Default body-parser limit Vercel (~4.5mb) bisa kurang buat upload file
// restore backup Redis yang isinya banyak key — dinaikkan supaya action
// 'backup' (op: 'restore') bisa terima payload lebih besar.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

// ===== SATU REDIS CLIENT UNTUK SELURUH FILE =====
// Sebelumnya `new Redis(...)` dibuat ulang di dalam masing-masing blok
// action (users/titles/stats) — connection setup yang sama diulang 3x
// walaupun cuma satu yang kepakai per request. Selain boros, `redis` yang
// dideklarasikan di dalam blok itu juga TIDAK terlihat oleh getTitles()
// di bawah (beda scope), jadi getTitles() sebelumnya crash dengan
// "redis is not defined" tiap kali dipanggil.
// redis singleton used

// Super admin dari environment (fallback)
const SUPER_ADMIN_IDS = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];
const ADMIN_IDS = SUPER_ADMIN_IDS; // dipakai action 'titles' & 'stats', nama lama dipertahankan

// ===== HELPER: Safe JSON parse =====
function safeJSONParse(data) {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('JSON parse error:', error.message);
    return null;
  }
}

// ===== HELPER: Get admin IDs dari Redis =====
async function getAdminIds() {
  try {
    const adminData = await redis.get('admin:ids');
    if (!adminData) {
      await redis.set('admin:ids', JSON.stringify([]));
      return [];
    }
    let adminIds = safeJSONParse(adminData);
    if (!Array.isArray(adminIds)) {
      adminIds = [];
      await redis.set('admin:ids', JSON.stringify(adminIds));
    }
    return adminIds;
  } catch (error) {
    console.error('Error getting admin IDs:', error);
    return [];
  }
}

// ===== HELPER: Ambil semua user (dipakai action 'users' GET & 'stats') =====
// Batch fetch pakai mget, bukan redis.get() satu-satu di dalam for-loop —
// untuk N user itu sebelumnya N round-trip berurutan ke Redis. Sekarang
// cuma 1 round-trip buat listing key + 1 round-trip buat ambil semua value.
async function getAllUsers() {
  let userIds = await redis.smembers('users:all');
  if (!userIds || userIds.length === 0) {
    let cursor = 0;
    let rawKeys = [];
    do {
      const res = await redis.scan(cursor, { match: 'user:*', count: 200 });
      cursor = Number(res[0]);
      rawKeys.push(...res[1]);
      if (rawKeys.length >= 2000) break;
    } while (cursor !== 0);

    const validKeys = rawKeys.filter((k) => k.split(':').length === 2 && !k.startsWith('user:email:'));
    userIds = validKeys.map((k) => k.slice(5));
    if (userIds.length > 0) {
      await redis.sadd('users:all', ...userIds).catch(() => {});
    }
  }

  if (!userIds || userIds.length === 0) return [];

  const userKeys = userIds.map((id) => 'user:' + id);
  const chunks = [];
  for (let i = 0; i < userKeys.length; i += 100) {
    chunks.push(userKeys.slice(i, i + 100));
  }

  const users = [];
  for (const chunk of chunks) {
    const values = await redis.mget(...chunk);
    for (const raw of values) {
      if (!raw) continue;
      const user = safeJSONParse(raw);
      if (user && user.id) users.push(user);
    }
  }
  return users;
}

async function getTitles() {
  const titlesData = await redis.get('titles');
  if (titlesData) {
    return typeof titlesData === 'string' ? JSON.parse(titlesData) : titlesData;
  }
  return [];
}

// ===== HELPER: Cek admin secara konsisten (env + Redis admin:ids) =====
// 'titles' & 'stats' sebelumnya cuma cek ADMIN_IDS dari env, jadi admin yang
// ditambahkan lewat panel (tersimpan di Redis) ditolak akses ke situ. Disamakan
// dengan pengecekan yang sudah benar di action 'users'.
async function checkIsAdmin(userId) {
  const adminIds = await getAdminIds();
  return adminIds.includes(userId) || SUPER_ADMIN_IDS.includes(userId);
}

// ===== HELPER: Pengaturan situs (maintenance mode, pengumuman & warna) =====
const DEFAULT_SITE_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: 'Ndichan sedang dalam perbaikan. Balik lagi sebentar lagi, ya!',
  announcement: {
    enabled: false,
    message: '',
    type: 'info' // info | warning | success
  },
  // Warna tema situs. Key di sini dipetakan 1:1 ke custom property CSS
  // var(--gold)/var(--ink)/dst di style.css, yang lalu di-override secara
  // global lewat aturan [class~="bg-[#d4a73c]"] dkk supaya semua pemakaian
  // warna hardcode di komponen ikut berubah tanpa perlu refactor tiap file.
  theme: {
    accentColor: '#d4a73c',      // --gold    (warna aksen/brand utama)
    backgroundColor: '#0b0b10',  // --ink     (latar belakang utama)
    panelColor: '#181820',       // --panel   (latar kartu/panel)
    panelColor2: '#141419',      // --ink-2   (latar panel sekunder/navbar)
    highlightColor: '#ff4e2d'    // --ember   (aksen sekunder/live/danger)
  }
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Validasi tiap field warna sebagai hex color; field yang tidak valid /
// tidak dikirim jatuh balik ke nilai di `base` (biasanya settings saat ini).
function sanitizeThemeInput(theme, base) {
  const fallback = base || DEFAULT_SITE_SETTINGS.theme;
  const clean = { ...DEFAULT_SITE_SETTINGS.theme, ...fallback };
  if (!theme || typeof theme !== 'object') return clean;
  for (const key of Object.keys(DEFAULT_SITE_SETTINGS.theme)) {
    const val = theme[key];
    if (typeof val === 'string' && HEX_COLOR_RE.test(val.trim())) {
      clean[key] = val.trim();
    }
  }
  return clean;
}

// ===== TEMPLATE EMAIL UCAPAN ULANG TAHUN =====
// Sengaja dibikin lebih ramai/meriah (confetti, balon, banner gradasi warna-warni)
// dibanding template notifikasi anime/komik yang lebih "kalem" tema situs.
function buildBirthdayEmailHtml({ name, message }) {
  const safeName = name || 'Sobat Ndichan';
  const confettiRow = '🎉 🎊 🎈 🎂 🎈 🎊 🎉';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selamat Ulang Tahun dari Ndichan</title>
  </head>
  <body style="background-color:#0a0a0c;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
    <div style="max-width:560px;margin:40px auto;background:linear-gradient(145deg,#16161a,#1a1a1e);border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
      <div style="background:linear-gradient(120deg,#ff6b9d,#c471ed,#f6cf80,#4ecdc4);padding:36px 30px 28px;text-align:center;">
        <p style="margin:0 0 10px;font-size:22px;letter-spacing:4px;">${confettiRow}</p>
        <h1 style="margin:0;font-size:30px;font-weight:900;color:#0a0a0c;text-shadow:0 1px 0 rgba(255,255,255,0.3);letter-spacing:-0.5px;">SELAMAT ULANG TAHUN!</h1>
        <p style="margin:8px 0 0;color:#0a0a0c;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.75;">Dari Seluruh Keluarga Besar Ndichan 🎁</p>
      </div>
      <div style="padding:38px 30px;text-align:center;">
        <p style="font-size:44px;margin:0 0 16px;">🎂🥳🎈</p>
        <p style="font-size:20px;color:#ffffff;margin:0 0 4px;">Happy Birthday,</p>
        <p style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#F6CF80,#f0b84d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 22px;">${safeName}! 🎉</p>
        <div style="background:rgba(246,207,128,0.06);border:1px solid rgba(246,207,128,0.15);border-radius:16px;padding:20px 22px;text-align:left;margin:0 0 26px;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.75);">
            ${message ? message : 'Semoga di umur yang baru ini kamu makin sehat, makin bahagia, rezekinya lancar, dan makin semangat nonton anime & baca komik favorit! Terima kasih sudah jadi bagian dari komunitas Ndichan 💛'}
          </p>
        </div>
        <a href="https://ndichan.xyz" style="display:inline-block;background:linear-gradient(135deg,#F6CF80,#f0b84d);color:#0a0a0c;font-weight:800;font-size:14px;padding:12px 34px;border-radius:999px;text-decoration:none;">Rayakan di Ndichan 🎈</a>
        <p style="margin-top:30px;color:rgba(255,255,255,0.2);font-size:11px;">Kamu menerima email ini karena terdaftar di Ndichan. Sekali lagi, selamat ulang tahun! 🎊</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

async function getSiteSettings() {
  const data = await redis.get('site:settings');
  const parsed = safeJSONParse(data);
  if (!parsed) return { ...DEFAULT_SITE_SETTINGS, theme: { ...DEFAULT_SITE_SETTINGS.theme } };
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...parsed,
    announcement: {
      ...DEFAULT_SITE_SETTINGS.announcement,
      ...(parsed.announcement || {})
    },
    theme: {
      ...DEFAULT_SITE_SETTINGS.theme,
      ...(parsed.theme || {})
    }
  };
}

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (action === 'users') {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      // Cek admin dari Redis dulu, baru dari ENV
      const adminIds = await getAdminIds();
      const isSuperAdmin = SUPER_ADMIN_IDS.includes(userId);
      const isAdmin = adminIds.includes(userId) || isSuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - Get all users
      if (req.method === 'GET') {
        // Ambil admin list & seluruh user secara paralel — independen satu sama lain.
        const [currentAdminIds, rawUsers] = await Promise.all([
          getAdminIds(),
          getAllUsers()
        ]);
        const adminIdSet = new Set(currentAdminIds);

        const users = rawUsers.map((user) => {
          delete user.password;
          user.isAdmin = adminIdSet.has(user.id);
          return user;
        });

        return res.json({
          success: true,
          users: users,
          total: users.length
        });
      }

      // POST - Create new user
      if (req.method === 'POST') {
        const { name, email, password, level, title, picture, isAdmin } = req.body;

        if (!name || !email || !password) {
          return res.status(400).json({ error: 'Name, email, and password required' });
        }

        // Cek email existing
        const existingEmail = await redis.get(`user:email:${email.toLowerCase()}`);
        if (existingEmail) {
          return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const hasCustomPicture = !!(picture && picture.trim() !== '');

        const newUser = {
          id: newUserId,
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          level: level || 0,
          title: title || 'Anime Newbie',
          picture: hasCustomPicture ? picture.trim() : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F6CF80&color=0a0a0c&size=128`,
          // Tandai kalau foto ini di-set manual oleh admin, supaya kalau user ini
          // suatu saat login lewat Google, fotonya tidak ketimpa foto Google.
          hasCustomAvatar: hasCustomPicture,
          watchTime: (level || 0) * 600,
          createdAt: new Date().toISOString(),
          authType: 'email'
        };

        await redis.set(`user:${newUserId}`, JSON.stringify(newUser));
        await redis.set(`user:email:${email.toLowerCase()}`, newUserId);
        await redis.zadd('leaderboard', { score: newUser.watchTime, member: newUserId });

        if (isAdmin) {
          let adminIds2 = await getAdminIds();
          if (!adminIds2.includes(newUserId)) {
            adminIds2.push(newUserId);
            await redis.set('admin:ids', JSON.stringify(adminIds2));
          }
        }

        delete newUser.password;
        return res.status(201).json({
          success: true,
          user: newUser
        });
      }

      // PUT - Update user
      if (req.method === 'PUT') {
        const { targetUserId, updates } = req.body;

        if (!targetUserId || !updates) {
          return res.status(400).json({ error: 'targetUserId and updates required' });
        }

        // Cari user berdasarkan ID
        const userData = await redis.get(`user:${targetUserId}`);
        if (!userData) {
          return res.status(404).json({ error: 'User not found' });
        }

        let user = safeJSONParse(userData);
        if (!user || !user.id) {
          return res.status(500).json({ error: 'User data corrupted' });
        }

        // ===== UPDATE USER ID =====
        if (updates.newUserId && updates.newUserId.trim() !== '' && updates.newUserId !== targetUserId) {
          const newId = updates.newUserId.trim();

          // Validasi ID baru
          if (!newId || newId.length < 2) {
            return res.status(400).json({ error: 'New user ID must be at least 2 characters' });
          }

          // Cek apakah ID baru sudah dipakai
          const existingUser = await redis.get(`user:${newId}`);
          if (existingUser) {
            return res.status(400).json({ error: 'New user ID already exists' });
          }

          const oldEmail = user.email;
          const oldId = targetUserId;

          // Update user object dengan ID baru
          const updatedUser = { ...user, id: newId };

          // Simpan dengan key baru
          await redis.set(`user:${newId}`, JSON.stringify(updatedUser));

          // Hapus key lama
          await redis.del(`user:${oldId}`);

          // Update email index jika ada
          if (oldEmail) {
            await redis.del(`user:email:${oldEmail.toLowerCase()}`);
            await redis.set(`user:email:${oldEmail.toLowerCase()}`, newId);
          }

          // Update leaderboard
          const watchTime = updatedUser.watchTime || 0;
          try {
            await redis.zrem('leaderboard', oldId);
          } catch (e) {
            console.warn('Failed to remove old leaderboard entry:', e.message);
          }
          if (watchTime > 0) {
            await redis.zadd('leaderboard', { score: watchTime, member: newId });
          }

          // Update admin list
          try {
            const adminData = await redis.get('admin:ids');
            let adminIds3 = safeJSONParse(adminData) || [];
            if (Array.isArray(adminIds3)) {
              if (adminIds3.includes(oldId)) {
                adminIds3 = adminIds3.filter(id => id !== oldId);
                if (!adminIds3.includes(newId)) {
                  adminIds3.push(newId);
                }
                await redis.set('admin:ids', JSON.stringify(adminIds3));
              }
            }
          } catch (e) {
            console.warn('Failed to update admin list:', e.message);
          }

          // Update history jika ada
          try {
            const historyKey = `history:${oldId}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            if (historyData && historyData.length > 0) {
              await redis.del(historyKey);
              const newHistoryKey = `history:${newId}`;
              await redis.rpush(newHistoryKey, ...historyData);
            }
          } catch (e) {
            console.warn('History migration warning:', e.message);
          }

          // Ambil data terbaru
          const finalData = await redis.get(`user:${newId}`);
          const finalUser = safeJSONParse(finalData);

          if (finalUser) {
            delete finalUser.password;
            finalUser.isAdmin = (await getAdminIds()).includes(newId);
          }

          return res.json({
            success: true,
            user: finalUser || updatedUser,
            message: `User ID updated successfully`
          });
        }

        // Update fields biasa (bukan ganti ID)
        const allowedUpdates = ['name', 'email', 'level', 'title', 'picture'];

        for (const field of allowedUpdates) {
          if (updates[field] !== undefined) {
            user[field] = updates[field];
          }
        }

        // ===== HANDLE PICTURE SECARA KHUSUS =====
        // Kalau admin isi URL foto baru -> tandai hasCustomAvatar supaya tidak
        // ketimpa foto Google saat user login ulang.
        // Kalau field dikosongkan (string kosong) -> jangan simpan string kosong
        // literal (bikin gambar rusak), tapi reset ke avatar auto-generate dan
        // matikan flag hasCustomAvatar supaya foto Google boleh dipakai lagi.
        if (updates.picture !== undefined) {
          const trimmedPicture = (updates.picture || '').trim();
          if (trimmedPicture === '') {
            user.picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=F6CF80&color=0a0a0c&size=128`;
            user.hasCustomAvatar = false;
          } else {
            user.picture = trimmedPicture;
            user.hasCustomAvatar = true;
          }
        }

        // Update password khusus
        if (updates.password && updates.password.trim() !== '') {
          user.password = await bcrypt.hash(updates.password, 10);
        }

        // Update watchTime based on level
        if (updates.level !== undefined) {
          const newLevel = parseInt(updates.level) || 0;
          user.watchTime = newLevel * 600;
          user.level = newLevel;
          try {
            await redis.zadd('leaderboard', { score: user.watchTime, member: targetUserId });
          } catch (e) {
            console.warn('Failed to update leaderboard:', e.message);
          }
        }

        // Update email key jika email berubah
        if (updates.email && updates.email.toLowerCase() !== user.email?.toLowerCase()) {
          if (user.email) {
            await redis.del(`user:email:${user.email.toLowerCase()}`);
          }
          await redis.set(`user:email:${updates.email.toLowerCase()}`, targetUserId);
        }

        // Update admin status
        if (updates.isAdmin !== undefined) {
          try {
            const currentAdmins = await redis.get('admin:ids');
            let adminIds4 = safeJSONParse(currentAdmins) || [];

            if (!Array.isArray(adminIds4)) {
              adminIds4 = [];
            }

            if (updates.isAdmin && !adminIds4.includes(targetUserId)) {
              adminIds4.push(targetUserId);
            } else if (!updates.isAdmin && adminIds4.includes(targetUserId)) {
              adminIds4 = adminIds4.filter(id => id !== targetUserId);
            }
            await redis.set('admin:ids', JSON.stringify(adminIds4));
          } catch (e) {
            console.warn('Failed to update admin status:', e.message);
          }
        }

        // Simpan perubahan
        await redis.set(`user:${targetUserId}`, JSON.stringify(user));

        // Ambil data final
        const finalUserData = await redis.get(`user:${targetUserId}`);
        const finalUser = safeJSONParse(finalUserData);

        if (!finalUser) {
          return res.status(500).json({ error: 'Failed to read updated user data' });
        }

        // Set admin status final
        const finalAdminList = await getAdminIds();
        finalUser.isAdmin = finalAdminList.includes(targetUserId);

        delete finalUser.password;

        return res.json({
          success: true,
          user: finalUser
        });
      }

      // DELETE - Delete user (single) OR bulk delete all users except a
      // chosen keep-list (deleteAllExcept)
      if (req.method === 'DELETE') {
        const { targetUserId, deleteAllExcept } = req.body || {};

        // ===== BULK: hapus semua user KECUALI yang ada di deleteAllExcept =====
        if (Array.isArray(deleteAllExcept)) {
          if (deleteAllExcept.length === 0) {
            return res.status(400).json({
              error: 'Pilih minimal satu user yang mau dipertahankan sebelum menghapus sisanya.'
            });
          }

          // Selalu ikutkan akun admin yang sedang login ke daftar "dipertahankan"
          // supaya admin gak bisa gak sengaja menghapus akunnya sendiri dan
          // ke-lock out dari panel admin.
          const keepSet = new Set([...deleteAllExcept, userId]);

          const allUsers = await getAllUsers();
          const toDelete = allUsers.filter((u) => !keepSet.has(u.id));

          if (toDelete.length === 0) {
            return res.json({ success: true, deletedCount: 0, message: 'Tidak ada user yang perlu dihapus.' });
          }

          const userKeys = toDelete.map((u) => `user:${u.id}`);
          const emailKeys = toDelete.filter((u) => u.email).map((u) => `user:email:${u.email.toLowerCase()}`);
          const historyKeys = toDelete.map((u) => `history:${u.id}`);
          const deleteIds = toDelete.map((u) => u.id);

          try {
            await Promise.all([
              redis.del(...userKeys),
              emailKeys.length ? redis.del(...emailKeys) : Promise.resolve(),
              redis.del(...historyKeys),
              redis.zrem('leaderboard', ...deleteIds),
              (async () => {
                let adminIds6 = await getAdminIds();
                adminIds6 = adminIds6.filter((id) => !deleteIds.includes(id));
                await redis.set('admin:ids', JSON.stringify(adminIds6));
              })()
            ]);
          } catch (e) {
            console.error('Bulk delete error:', e);
            return res.status(500).json({ error: 'Sebagian data gagal dihapus. Coba lagi.' });
          }

          return res.json({
            success: true,
            deletedCount: toDelete.length,
            keptCount: keepSet.size,
            message: `${toDelete.length} user berhasil dihapus.`
          });
        }

        // ===== SINGLE: hapus satu user (perilaku lama) =====
        if (!targetUserId) {
          return res.status(400).json({ error: 'targetUserId required' });
        }

        // Ambil data user sebelum dihapus untuk dapatkan email
        const userData = await redis.get(`user:${targetUserId}`);
        if (userData) {
          const user = safeJSONParse(userData);
          if (user?.email) {
            await redis.del(`user:email:${user.email.toLowerCase()}`);
          }
        }

        // Hapus dari admin list
        try {
          let adminIds5 = await getAdminIds();
          adminIds5 = adminIds5.filter(id => id !== targetUserId);
          await redis.set('admin:ids', JSON.stringify(adminIds5));
        } catch (e) {
          console.warn('Failed to update admin list:', e.message);
        }

        // Hapus data user
        await redis.del(`user:${targetUserId}`);

        // Hapus dari leaderboard
        try {
          await redis.zrem('leaderboard', targetUserId);
        } catch (e) {
          console.warn('Failed to remove from leaderboard:', e.message);
        }

        // Hapus history
        try {
          await redis.del(`history:${targetUserId}`);
        } catch (e) {
          console.warn('Failed to delete history:', e.message);
        }

        return res.json({
          success: true,
          message: 'User deleted successfully'
        });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('❌ Admin users error:', error);

      if (error.message?.includes('JSON')) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Data corruption detected. Please check Redis data.'
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      });
    }
  } else if (action === 'titles') {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - Get all titles
      if (req.method === 'GET') {
        const titles = await getTitles();
        return res.json({ success: true, titles });
      }

      // POST - Add new title
      if (req.method === 'POST') {
        const { name, level } = req.body;
        if (!name || level === undefined) {
          return res.status(400).json({ error: 'Name and level required' });
        }

        const titles = await getTitles();
        titles.push({ name, level: parseInt(level) });
        titles.sort((a, b) => a.level - b.level);

        await redis.set('titles', JSON.stringify(titles));
        return res.json({ success: true, titles });
      }

      // PUT - Update title
      if (req.method === 'PUT') {
        const { oldName, name, level } = req.body;
        if (!oldName || !name || level === undefined) {
          return res.status(400).json({ error: 'Old name, name, and level required' });
        }

        let titles = await getTitles();
        const index = titles.findIndex(t => t.name === oldName);
        if (index === -1) {
          return res.status(404).json({ error: 'Title not found' });
        }

        titles[index] = { name, level: parseInt(level) };
        titles.sort((a, b) => a.level - b.level);

        await redis.set('titles', JSON.stringify(titles));
        return res.json({ success: true, titles });
      }

      // DELETE - Remove title
      if (req.method === 'DELETE') {
        const { name } = req.body;
        if (!name) {
          return res.status(400).json({ error: 'Name required' });
        }

        let titles = await getTitles();
        titles = titles.filter(t => t.name !== name);

        await redis.set('titles', JSON.stringify(titles));
        return res.json({ success: true, titles });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin titles error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'stats') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Batch fetch semua user (mget), bukan redis.get() satu-satu di for-loop.
      const users = await getAllUsers();

      let totalWatchTime = 0;
      let totalLevels = 0;
      let maxLevel = 0;

      for (const user of users) {
        totalWatchTime += user.watchTime || 0;
        totalLevels += user.level || 0;
        maxLevel = Math.max(maxLevel, user.level || 0);
      }

      const totalUsers = users.length;

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalWatchTime,
          totalHours: Math.floor(totalWatchTime / 3600),
          averageLevel: totalUsers > 0 ? Math.round(totalLevels / totalUsers) : 0,
          maxLevel,
          totalLevels
        }
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'settings') {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - Ambil pengaturan situs saat ini
      if (req.method === 'GET') {
        const settings = await getSiteSettings();
        return res.json({ success: true, settings });
      }

      // PUT - Update pengaturan situs
      if (req.method === 'PUT') {
        const { maintenanceMode, maintenanceMessage, announcement, theme } = req.body || {};

        const current = await getSiteSettings();
        const updated = { ...current };

        if (maintenanceMode !== undefined) {
          updated.maintenanceMode = !!maintenanceMode;
        }
        if (maintenanceMessage !== undefined) {
          updated.maintenanceMessage = String(maintenanceMessage).slice(0, 500);
        }
        if (announcement !== undefined) {
          updated.announcement = {
            enabled: !!announcement.enabled,
            message: String(announcement.message || '').slice(0, 300),
            type: ['info', 'warning', 'success'].includes(announcement.type) ? announcement.type : 'info'
          };
        }
        if (theme !== undefined) {
          // Tiap field divalidasi sebagai hex color (#rgb / #rrggbb). Field
          // yang tidak valid / tidak dikirim jatuh balik ke nilai saat ini.
          updated.theme = sanitizeThemeInput(theme, current.theme);
        }

        await redis.set('site:settings', JSON.stringify(updated));

        return res.json({ success: true, settings: updated });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'notify') {
    // ===== NOTIFIKASI ANIME/KOMIK BARU =====
    // Pengiriman email sekarang otomatis lewat cron job eksternal yang
    // memanggil /api/v1/cron/notify — tidak ada lagi fitur kirim manual di
    // sini. Endpoint ini cuma buat: (1) menampilkan status rilisan terakhir
    // yang sudah dinotifikasi otomatis, dan (2) mengelola daftar email yang
    // dikecualikan dari notifikasi.
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - status notifikasi otomatis terakhir + daftar email dikecualikan
      if (req.method === 'GET') {
        const [lastAnime, lastKomik, excluded] = await Promise.all([
          getLastNotified('anime'),
          getLastNotified('komik'),
          listExcludedEmails(),
        ]);
        return res.json({
          success: true,
          lastSent: { anime: lastAnime || null, komik: lastKomik || null },
          excluded,
        });
      }

      // POST - tambah email ke daftar dikecualikan
      if (req.method === 'POST') {
        const { email } = req.body || {};
        try {
          const excluded = await addExcludedEmail(email);
          return res.json({ success: true, excluded });
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Email tidak valid' });
        }
      }

      // DELETE - hapus email dari daftar dikecualikan
      if (req.method === 'DELETE') {
        const email = (req.query.email || '').toString();
        if (!email) {
          return res.status(400).json({ error: 'email wajib diisi' });
        }
        const excluded = await removeExcludedEmail(email);
        return res.json({ success: true, excluded });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin notify error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'birthday') {
    // ===== UCAPAN ULANG TAHUN =====
    // Admin pilih user (bisa banyak sekaligus) lalu kirim email ucapan
    // ulang tahun yang meriah. Tidak ada kunci anti-duplikat di sini karena
    // ulang tahun kejadiannya tahunan & memang sengaja dipicu manual oleh admin.
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const adminId = decoded.userId;

      if (!(await checkIsAdmin(adminId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userIds, message } = req.body || {};

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal 1 user untuk dikirimi ucapan' });
      }

      const keys = userIds.map((id) => `user:${id}`);
      const values = await redis.mget(...keys);
      const recipients = values
        .map((raw) => safeJSONParse(raw))
        .filter((u) => u && u.email && u.email.includes('@'));

      if (recipients.length === 0) {
        return res.status(400).json({ error: 'Tidak ada penerima dengan email valid' });
      }

      const { transporter, from } = await getTransporter();

      const results = await Promise.allSettled(
        recipients.map((r) =>
          transporter.sendMail({
            from: `"Ndichan" <${from}>`,
            to: r.email,
            subject: `🎉 Selamat Ulang Tahun, ${r.name || 'Sobat Ndichan'}!`,
            html: buildBirthdayEmailHtml({ name: r.name, message: (message || '').trim() }),
          })
        )
      );

      const sentCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.length - sentCount;

      return res.json({
        success: true,
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
      });
    } catch (error) {
      console.error('Admin birthday error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'mail-settings') {
    // ===== PENGATURAN EMAIL PENGIRIM (GANTI EMAIL & PASSWORD DARI ADMIN) =====
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - password TIDAK PERNAH dikirim balik ke client, cuma status ada/tidaknya
      if (req.method === 'GET') {
        const settings = await getEmailSettings();
        return res.json({
          success: true,
          settings: {
            user: settings.user,
            from: settings.from,
            host: settings.host,
            port: settings.port,
            hasPassword: !!settings.pass,
          },
        });
      }

      // PUT - update pengaturan. Field `pass` opsional: kalau dikosongkan, password lama dipertahankan.
      if (req.method === 'PUT') {
        const { user, pass, from, host, port } = req.body || {};
        const updated = await saveEmailSettings({ user, pass, from, host, port });
        return res.json({
          success: true,
          settings: {
            user: updated.user,
            from: updated.from,
            host: updated.host,
            port: updated.port,
            hasPassword: !!updated.pass,
          },
        });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin mail-settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'backup') {
    // ===== BACKUP & RESTORE REDIS LEWAT TELEGRAM =====
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - status pengaturan telegram (token tidak pernah dikirim utuh) + backup terakhir
      if (req.method === 'GET') {
        const [settings, lastBackup] = await Promise.all([
          getTelegramSettings(),
          getLastBackupInfo(),
        ]);
        return res.json({
          success: true,
          settings: {
            hasBotToken: !!settings.botToken,
            chatId: settings.chatId,
          },
          lastBackup: lastBackup || null,
        });
      }

      if (req.method === 'POST') {
        const { op } = req.body || {};

        // ===== SIMPAN PENGATURAN BOT TELEGRAM =====
        if (op === 'save-settings') {
          const { botToken, chatId } = req.body || {};
          const updated = await saveTelegramSettings({ botToken, chatId });
          return res.json({
            success: true,
            settings: { hasBotToken: !!updated.botToken, chatId: updated.chatId },
          });
        }

        // ===== JALANKAN BACKUP SEKARANG & KIRIM KE TELEGRAM =====
        if (op === 'run') {
          const settings = await getTelegramSettings();
          if (!settings.botToken || !settings.chatId) {
            return res.status(400).json({ error: 'Atur dulu bot token & chat ID Telegram sebelum backup.' });
          }

          const backup = await buildFullBackup();
          await sendBackupToTelegram(backup, settings);

          const info = { success: true, totalKeys: backup.totalKeys, sentAt: new Date().toISOString() };
          await setLastBackupInfo(info);

          return res.json({ success: true, totalKeys: backup.totalKeys });
        }

        // ===== RESTORE DARI FILE BACKUP YANG DIUPLOAD ADMIN =====
        if (op === 'restore') {
          const { data, wipeBefore } = req.body || {};
          if (!data || !Array.isArray(data.entries)) {
            return res.status(400).json({ error: 'File backup tidak valid atau bukan hasil export dari fitur ini.' });
          }

          const result = await restoreFromBackup(data, { wipeBefore: !!wipeBefore });
          return res.json({ success: true, ...result });
        }

        // ===== HAPUS SEMUA DATABASE (RESET TOTAL) =====
        // Aksi paling destruktif di panel ini — wajib ketik ulang frasa
        // konfirmasi persis, dan sebisa mungkin kirim safety-backup ke
        // Telegram dulu sebelum benar-benar menghapus semuanya.
        if (op === 'wipe-all') {
          const CONFIRM_PHRASE = 'HAPUS SEMUA DATA';
          const { confirm } = req.body || {};
          if (confirm !== CONFIRM_PHRASE) {
            return res.status(400).json({ error: `Konfirmasi tidak sesuai. Ketik persis: ${CONFIRM_PHRASE}` });
          }

          let safetyBackup = null;
          try {
            const settings = await getTelegramSettings();
            if (settings.botToken && settings.chatId) {
              const backup = await buildFullBackup();
              await sendBackupToTelegram(backup, settings);
              await setLastBackupInfo({ success: true, totalKeys: backup.totalKeys, sentAt: new Date().toISOString() });
              safetyBackup = { sent: true, totalKeys: backup.totalKeys };
            } else {
              safetyBackup = { sent: false, reason: 'Telegram belum diatur' };
            }
          } catch (e) {
            console.error('Safety backup before wipe-all failed:', e);
            safetyBackup = { sent: false, error: e.message };
          }

          const result = await wipeAllKeys();
          return res.json({ success: true, deleted: result.deleted, safetyBackup });
        }

        return res.status(400).json({ error: 'op tidak dikenal' });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin backup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'clans') {
    // ===== KELOLA SEMUA CLAN (akses penuh, gak peduli role member) =====
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      if (!(await checkIsAdmin(userId))) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // GET - daftar semua clan lengkap (member, treasury, xp, dll)
      if (req.method === 'GET') {
        const result = await adminListClans(redis);
        return res.json(result);
      }

      // GET gacha pool khusus (buat dropdown "grant item")
      // dipisah biar gak keikut kebawa payload besar tiap load daftar clan
      if (req.method === 'POST' && req.body?.op === 'gacha-pool') {
        return res.json({ success: true, items: GACHA_POOL });
      }

      // POST - berbagai sub-aksi lewat body.op
      if (req.method === 'POST') {
        const { op, clanId, targetUserId, role, itemId, patch } = req.body || {};

        if (op === 'edit') {
          const result = await adminEditClan(redis, clanId, patch || {});
          return res.json(result);
        }
        if (op === 'set-role') {
          const result = await adminSetMemberRole(redis, clanId, targetUserId, role);
          return res.json(result);
        }
        if (op === 'kick') {
          const result = await adminKickMember(redis, clanId, targetUserId);
          return res.json(result);
        }
        if (op === 'disband') {
          const result = await adminDisbandClan(redis, clanId);
          return res.json(result);
        }
        if (op === 'grant-item') {
          const result = await adminGrantGachaItem(redis, clanId, itemId);
          return res.json(result);
        }
        return res.status(400).json({ error: 'Operasi tidak dikenal' });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Admin clans error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(404).json({
      error: 'Endpoint not found'
    });
  }
}
