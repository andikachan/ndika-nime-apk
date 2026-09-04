import redis from '../_lib/redis.js';
import { getJwtSecret, verifyUserId, verifyToken } from '../_lib/auth.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { CLASSES, GUILDS, setUserGuild, addItem } from '../_lib/rpg.js';

// ===== SATU REDIS CLIENT UNTUK SELURUH FILE =====
// Sebelumnya file ini terpecah jadi 5 file terpisah (users.js, avatar.js,
// watch-time.js, [id].js, [id]/history.js) yang masing-masing bikin
// `new Redis(...)` sendiri. Sekarang digabung jadi satu file seperti
// auth/[...action].js dan admin/[...action].js, jadi cukup 1 client.
// redis singleton used

// Super admin dari environment (dipakai action 'users' & user detail)
const SUPER_ADMIN_IDS = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];

// ===== HELPER: Safe JSON parse (dipakai beberapa action) =====
const safeParse = (item) => {
  try {
    if (!item) return null;
    if (typeof item === 'object') return item;
    return JSON.parse(item);
  } catch {
    return null;
  }
};

// ===== HELPER: Verifikasi JWT dari cookie (dipakai action 'avatar' & 'watch-time') =====
// verifyToken imported from _lib/auth.js

// ===== HELPER: Validasi untuk action 'avatar' =====
const isValidUrl = (value) => /^https?:\/\//i.test(value);

// Validasi format "x% y%" dengan x,y di rentang 0-100
const isValidBannerPosition = (value) => /^-?\d{1,3}(\.\d+)?%\s+-?\d{1,3}(\.\d+)?%$/.test(value.trim());

const clampPositionString = (value) => {
  const [xRaw, yRaw] = value.trim().split(/\s+/);
  const x = Math.min(100, Math.max(0, parseFloat(xRaw)));
  const y = Math.min(100, Math.max(0, parseFloat(yRaw)));
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
};

// ===== HELPER: Scan semua key user (dipakai action 'users') =====
async function scanUserKeys(limit = 5000) {
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
  return userIds.slice(0, limit).map((id) => 'user:' + id);
}

// ===== HELPER: Bonus XP (detik watch-time) per hari streak (dipakai action 'streak') =====
// Makin panjang streak-nya, makin gede bonusnya — reward konsistensi.
function getStreakBonusSeconds(streakCount) {
  if (streakCount >= 100) return 900; // 15 menit setara XP
  if (streakCount >= 30) return 600;  // 10 menit
  if (streakCount >= 7) return 300;   // 5 menit
  return 120;                          // 2 menit (hari 1-6)
}

// Selisih hari kalender antara 2 string 'YYYY-MM-DD'
function dayDiff(dateStrA, dateStrB) {
  const a = new Date(`${dateStrA}T00:00:00Z`).getTime();
  const b = new Date(`${dateStrB}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

// ===== HELPER: Daftar frame avatar & syarat level (dipakai action 'avatar') =====
// Definisi visual (warna/gradient) ada di frontend src/utils/profileFrames.js,
// di sini cuma buat validasi "level user cukup nggak buat pakai frame ini".
const FRAMES = [
  { id: 'none', minLevel: 0 },
  { id: 'bronze', minLevel: 5 },
  { id: 'silver', minLevel: 15 },
  { id: 'gold', minLevel: 30 },
  { id: 'fire', minLevel: 50 },
  { id: 'platinum', minLevel: 75 },
  { id: 'rainbow', minLevel: 150 }
];

// ===== HELPER: Daftar animated aura profil & syarat level =====
const AURAS = [
  { id: 'none', minLevel: 0 },
  { id: 'supersaiyan', minLevel: 10 },
  { id: 'shadowneon', minLevel: 25 },
  { id: 'cursedflame', minLevel: 45 },
  { id: 'glacier', minLevel: 70 },
  { id: 'phoenix', minLevel: 100 },
  { id: 'celestial', minLevel: 150 }
];

// ===== HELPER: Daftar title level (dipakai action 'watch-time') =====
async function getTitles() {
  const titlesData = await redis.get('titles');
  if (titlesData) {
    return typeof titlesData === 'string' ? JSON.parse(titlesData) : titlesData;
  }

  const defaultTitles = [
    { level: 0, name: 'Anime Newbie' },
    { level: 5, name: 'Anime Watcher' },
    { level: 10, name: 'Anime Lover' },
    { level: 20, name: 'Anime Enthusiast' },
    { level: 30, name: 'Anime Master' },
    { level: 50, name: 'Anime Legend' },
    { level: 75, name: 'Anime God' },
    { level: 100, name: 'Anime Supreme' },
    { level: 150, name: 'Anime Overlord' },
    { level: 200, name: 'Anime Emperor' },
    { level: 300, name: 'Anime Immortal' },
    { level: 500, name: 'Anime Universe' },
    { level: 1000, name: 'Anime Creator' }
  ];

  await redis.set('titles', JSON.stringify(defaultTitles));
  return defaultTitles;
}

// ===== FITUR ULANG TAHUN =====
const BIRTHDAY_WISH_REWARD = 300;   // XP (detik watchTime) buat yang ngirim ucapan, per orang yang diucapin
const BIRTHDAY_GIFT_REWARD = 1800;  // XP (detik watchTime) buat yang lagi ulang tahun
const BIRTHDAY_GIFT_ITEM = 'scroll_2x'; // item bonus yang otomatis didapat pas klaim hadiah ulang tahun

// 'MM-DD' hari ini (dipakai buat cocokin ulang tahun, diabaikan tahunnya)
// PENTING: server Vercel jalan di UTC, tapi user kita WIB (UTC+7, no DST).
// Kalau dihitung pakai UTC polos, "hari ini" versi server baru ganti jam 07:00 WIB,
// jadi lewat tengah malam WIB masih kebaca tanggal kemarin. Makanya digeser +7 jam dulu.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const nowWIB = () => new Date(Date.now() + WIB_OFFSET_MS);
const todayMonthDay = () => nowWIB().toISOString().slice(5, 10);
const currentYear = () => nowWIB().getUTCFullYear();

// Tambah XP ke watchTime user + recompute level & title, lalu update leaderboard.
// Dipakai bareng oleh action 'birthday-wish' & 'birthday-claim' supaya logikanya konsisten
// dengan cara reward quest/watch-time lain dihitung di file ini.
async function grantBirthdayXp(userId, amount) {
  const userKeyStr = `user:${userId}`;
  const userDataRaw = await redis.get(userKeyStr);
  if (!userDataRaw) return null;

  const user = typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw;
  const currentWatchTime = user.watchTime || 0;
  const newWatchTime = currentWatchTime + amount;
  const newLevel = Math.floor(newWatchTime / 600);

  user.watchTime = newWatchTime;
  user.level = newLevel;
  user.lastWatchUpdate = new Date().toISOString();

  const titles = await getTitles();
  let newTitle = user.title || 'Anime Newbie';
  let titleLevel = user.titleLevel || 0;
  for (const title of titles) {
    if (newLevel >= title.level && title.level > titleLevel) {
      newTitle = title.name;
      titleLevel = title.level;
    }
  }
  user.title = newTitle;
  user.titleLevel = titleLevel;

  await redis.set(userKeyStr, JSON.stringify(user));
  await redis.zadd('leaderboard', { score: newWatchTime, member: userId });

  return { watchTime: newWatchTime, level: newLevel, title: newTitle };
}
const SITE_URL = 'https://ndichan.xyz';
const EXTERNAL_API = 'https://api.ndikacunk.my.id';
const CACHE_KEY = 'sitemap:xml';
const CACHE_TTL_SEC = 6 * 60 * 60; // regenerate tiap 6 jam

// Batas halaman/paginasi biar generate-nya gak kelamaan atau kena timeout
// function serverless. Cukup buat nampung ribuan judul.
const MAX_ANIME_PAGES = 25;
const MAX_KOMIK_PAGES = 25;
const FETCH_TIMEOUT_MS = 6000;

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const xmlEscape = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Sitemap fetch failed for ${url}:`, error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ===== Katalog anime (paginasi berbasis nomor halaman) =====
async function collectAnimeUrls() {
  const urls = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_ANIME_PAGES; page++) {
    const body = await fetchJSON(`${EXTERNAL_API}/v1/popular?page=${page}`);
    const items = body?.data;
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const slug = `${item.id}-${slugify(item.title)}`;
      urls.push({ loc: `${SITE_URL}/anime/${slug}`, changefreq: 'weekly', priority: '0.8' });
    }
  }

  return urls;
}

// ===== Katalog komik (paginasi berbasis cursor) =====
async function collectKomikUrls() {
  const urls = [];
  const seen = new Set();
  let after = null;

  for (let page = 0; page < MAX_KOMIK_PAGES; page++) {
    const params = new URLSearchParams({ limit: '40' });
    if (after) params.set('after', after);

    const body = await fetchJSON(`${EXTERNAL_API}/v1/manga/allcomics?${params.toString()}`);
    const items = body?.data;
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      if (!item?.slug || seen.has(item.slug)) continue;
      seen.add(item.slug);
      urls.push({ loc: `${SITE_URL}/komik/${item.slug}`, changefreq: 'weekly', priority: '0.7' });
    }

    if (!body?.cursor?.hasNext || !body?.cursor?.nextCursor) break;
    after = body.cursor.nextCursor;
  }

  return urls;
}

function staticUrls() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    ['/', 'daily', '1.0'],
    ['/home', 'daily', '0.9'],
    ['/explore', 'daily', '0.9'],
    ['/ongoing', 'daily', '0.8'],
    ['/new', 'daily', '0.8'],
    ['/schedule', 'daily', '0.7'],
    ['/komik', 'daily', '0.8'],
    ['/komik/populer', 'daily', '0.7'],
    ['/komik/latest', 'daily', '0.7'],
    ['/komik/all', 'weekly', '0.7']
  ];
  return entries.map(([path, changefreq, priority]) => ({
    loc: `${SITE_URL}${path}`,
    lastmod: today,
    changefreq,
    priority
  }));
}

function buildXml(urls) {
  const body = urls
    .map(
      (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}
export default async function handler(req, res) {
  const { sub } = req.query;
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (action === 'titles') {
    // ===== GET /api/v1/user/titles — katalog title lengkap (dipakai UI kustomisasi profil) =====
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const titles = await getTitles();
      return res.json({ success: true, titles, frames: FRAMES });
    } catch (error) {
      console.error('Get titles error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'sitemap') {
const forceRefresh = req.query?.refresh === '1';

  if (!forceRefresh) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
        return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
      }
    } catch (error) {
      console.error('Sitemap cache read error:', error);
    }
  }

  let urls = staticUrls();
  try {
    const [animeUrls, komikUrls] = await Promise.all([collectAnimeUrls(), collectKomikUrls()]);
    urls = urls.concat(animeUrls, komikUrls);
  } catch (error) {
    console.error('Sitemap collect error:', error);
    // Tetep lanjut kirim sitemap statis aja kalau katalog gagal diambil,
    // daripada nge-500 dan bikin Search Console error total.
  }

  const xml = buildXml(urls);

  try {
    await redis.set(CACHE_KEY, xml, { ex: CACHE_TTL_SEC });
  } catch (error) {
    console.error('Sitemap cache write error:', error);
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
    } else if (action === 'leaderboard') {
res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get top 100 users from leaderboard
    // Gunakan zrange dengan parameter 0, 99 dan REV
    const leaderboard = await redis.zrange('leaderboard', 0, 99, { rev: true });
    
    // zrange dengan withScores
    const leaderboardWithScores = await redis.zrange('leaderboard', 0, 99, { 
      rev: true,
      withScores: true 
    });
    
    const users = [];
    
    // Process results
    for (let i = 0; i < leaderboardWithScores.length; i += 2) {
      const userId = leaderboardWithScores[i];
      const watchTime = parseInt(leaderboardWithScores[i + 1]);
      
      if (!userId) continue;
      
      const userData = await redis.get(`user:${userId}`);
      if (userData) {
        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
        users.push({
          id: userId,
          name: user.name || 'Unknown',
          picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=F6CF80&color=0a0a0c&size=128`,
          level: user.level || 0,
          watchTime: watchTime,
          title: user.title || 'Anime Newbie',
          rank: i / 2 + 1
        });
      }
    }

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
    } else if (action === 'site-config') {
res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEFAULT_SITE_SETTINGS = {
    maintenanceMode: false,
    maintenanceMessage: 'Ndichan sedang dalam perbaikan. Balik lagi sebentar lagi, ya!',
    announcement: { enabled: false, message: '', type: 'info' },
    theme: {
      accentColor: '#d4a73c',
      backgroundColor: '#0b0b10',
      panelColor: '#181820',
      panelColor2: '#141419',
      highlightColor: '#ff4e2d'
    }
  };

  try {
    const raw = await redis.get('site:settings');
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    const settings = parsed
      ? {
          ...DEFAULT_SITE_SETTINGS,
          ...parsed,
          announcement: { ...DEFAULT_SITE_SETTINGS.announcement, ...(parsed.announcement || {}) },
          theme: { ...DEFAULT_SITE_SETTINGS.theme, ...(parsed.theme || {}) }
        }
      : DEFAULT_SITE_SETTINGS;

    // Publik: jangan bocorkan field lain selain yang dibutuhkan frontend.
    res.json({
      success: true,
      config: {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        announcement: settings.announcement,
        theme: settings.theme
      }
    });
  } catch (error) {
    console.error('Site config error:', error);
    // Kalau Redis gagal, jangan sampai mengunci seluruh situs — anggap normal.
    res.json({ success: true, config: DEFAULT_SITE_SETTINGS });
  }
    } else if (action === 'users') {
    // ===== SEARCH USERS (dulu: api/v1/user/users.js) =====
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { q } = req.query;

      if (!q || q.trim().length === 0) {
        return res.json({ success: true, users: [], total: 0 });
      }

      const searchQuery = q.toLowerCase().trim();
      console.log(`🔍 Searching: ${searchQuery}`);

      // Ambil admin + scan user bersamaan
      const [adminData, keys] = await Promise.all([
        redis.get('admin:ids').catch(() => null),
        scanUserKeys(5000)
      ]);

      let adminIds = [];
      try {
        if (adminData) {
          adminIds = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
        }
      } catch {
        adminIds = [];
      }

      for (const id of SUPER_ADMIN_IDS) {
        if (!adminIds.includes(id)) {
          adminIds.push(id);
        }
      }

      const adminSet = new Set(adminIds.map(String));
      const userKeys = keys.filter(key => !key.includes('email:'));

      if (!userKeys.length) {
        return res.json({ success: true, users: [], total: 0, query: searchQuery });
      }

      // Upstash REST punya limit payload, jadi jangan mget ribuan sekaligus
      const chunks = [];
      for (let i = 0; i < userKeys.length; i += 500) {
        chunks.push(userKeys.slice(i, i + 500));
      }

      const values = [];
      for (const chunk of chunks) {
        const result = await redis.mget(...chunk);
        values.push(...result);
      }

      const words = searchQuery.split(' ').filter(Boolean);
      const users = [];

      for (const raw of values) {
        if (!raw) continue;

        let user;
        try {
          user = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          continue;
        }

        if (!user?.name) continue;

        const name = user.name.toLowerCase();
        const email = user.email?.toLowerCase() || '';

        const matched =
          name.includes(searchQuery) ||
          email.includes(searchQuery) ||
          words.some(word => name.includes(word));

        if (!matched) continue;

        delete user.password;
        user.isAdmin = adminSet.has(String(user.id));

        if (name === searchQuery) user.matchScore = 100;
        else if (name.startsWith(searchQuery)) user.matchScore = 80;
        else if (name.includes(searchQuery)) user.matchScore = 60;
        else if (email.includes(searchQuery)) user.matchScore = 20;
        else user.matchScore = 10;

        users.push(user);
      }

      users.sort((a, b) => b.matchScore - a.matchScore);

      return res.json({
        success: true,
        users: users.slice(0, 30),
        total: users.length,
        query: searchQuery
      });
    } catch (error) {
      console.error('❌ Search users error:', error);
      return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  } else if (action === 'avatar') {
    // ===== UPDATE PROFIL: foto, banner, posisi banner, nama (dulu: api/v1/user/avatar.js) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyToken(req);

      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }

      const { picture, banner, bannerPosition, name, bio, title, customTitle, frame, aura, themeSong } = body || {};

      // Setidaknya satu field harus dikirim
      if (
        picture === undefined &&
        banner === undefined &&
        bannerPosition === undefined &&
        name === undefined &&
        bio === undefined &&
        title === undefined &&
        customTitle === undefined &&
        frame === undefined &&
        aura === undefined &&
        themeSong === undefined
      ) {
        return res.status(400).json({ error: 'Tidak ada data yang dikirim' });
      }

      // User data dimuat lebih dulu karena validasi title & frame butuh tahu
      // level/titleLevel user saat ini (nggak bisa pasang yang belum di-unlock).
      const userKey = `user:${userId}`;
      const existing = await redis.get(userKey);
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = typeof existing === 'string' ? JSON.parse(existing) : existing;

      const updates = {};

      // ===== Validasi & siapkan update foto profil =====
      if (picture !== undefined) {
        if (!picture || typeof picture !== 'string' || !isValidUrl(picture)) {
          return res.status(400).json({ error: 'picture harus berupa URL yang valid' });
        }
        updates.picture = picture;
        updates.hasCustomAvatar = true; // tandai supaya login Google berikutnya tidak menimpa foto ini
      }

      // ===== Validasi & siapkan update banner =====
      if (banner !== undefined) {
        if (!banner || typeof banner !== 'string' || !isValidUrl(banner)) {
          return res.status(400).json({ error: 'banner harus berupa URL yang valid' });
        }
        updates.banner = banner;
        updates.hasCustomBanner = true; // jaga-jaga kalau nanti login Google/provider lain mulai kirim banner juga
      }

      // ===== Validasi & siapkan update posisi banner (mis. "50.0% 30.0%") =====
      if (bannerPosition !== undefined) {
        if (typeof bannerPosition !== 'string' || !isValidBannerPosition(bannerPosition)) {
          return res.status(400).json({ error: 'bannerPosition harus berformat "x% y%"' });
        }
        updates.bannerPosition = clampPositionString(bannerPosition);
      }

      // ===== Validasi & siapkan update nama =====
      if (name !== undefined) {
        if (typeof name !== 'string') {
          return res.status(400).json({ error: 'name harus berupa teks' });
        }
        const trimmedName = name.trim();
        if (!trimmedName) {
          return res.status(400).json({ error: 'Nama tidak boleh kosong' });
        }
        if (trimmedName.length > 30) {
          return res.status(400).json({ error: 'Nama maksimal 30 karakter' });
        }
        updates.name = trimmedName;
        updates.hasCustomName = true; // tandai supaya login Google berikutnya tidak menimpa nama ini
      }

      // ===== Validasi & siapkan update bio =====
      if (bio !== undefined) {
        updates.bio = typeof bio === 'string' ? bio.trim().slice(0, 300) : '';
      }

      // ===== Validasi & siapkan update title aktif (KUSTOMISASI PROFIL) =====
      // User cuma boleh pakai title yang levelnya <= titleLevel (title tertinggi yang sudah di-unlock).
      if (title !== undefined) {
        const titles = await getTitles();
        const userTitleLevel = user.titleLevel || 0;
        const match = titles.find((t) => t.name === title && t.level <= userTitleLevel);
        if (!match) {
          return res.status(400).json({ error: 'Title belum kamu unlock' });
        }
        updates.title = match.name;
      }

      // ===== Validasi & siapkan update Custom Title bebas =====
      if (customTitle !== undefined) {
        if (customTitle === null || customTitle === '') {
          updates.customTitle = '';
        } else if (typeof customTitle === 'string') {
          updates.customTitle = customTitle.trim().slice(0, 35);
        }
      }

      // ===== Validasi & siapkan update frame avatar (KUSTOMISASI PROFIL) =====
      // User cuma boleh pakai frame yang minLevel-nya <= level user saat ini.
      if (frame !== undefined) {
        const userLevel = user.level || 0;
        const match = FRAMES.find((f) => f.id === frame && f.minLevel <= userLevel);
        if (!match) {
          return res.status(400).json({ error: 'Frame belum kamu unlock' });
        }
        updates.frame = match.id;
      }

      // ===== Validasi & siapkan update Animated Profile Aura =====
      if (aura !== undefined) {
        const userLevel = user.level || 0;
        const match = AURAS.find((a) => a.id === aura && a.minLevel <= userLevel);
        if (!match) {
          return res.status(400).json({ error: 'Aura belum kamu unlock' });
        }
        updates.aura = match.id;
      }

      // ===== Validasi & siapkan update Anime BGM / Profile Theme Song =====
      if (themeSong !== undefined) {
        if (themeSong === null || !themeSong.url) {
          updates.themeSong = null;
        } else {
          updates.themeSong = {
            id: String(themeSong.id || 'custom').slice(0, 40),
            title: String(themeSong.title || 'Anime Theme Song').slice(0, 50),
            artist: String(themeSong.artist || '').slice(0, 50),
            anime: String(themeSong.anime || '').slice(0, 50),
            url: String(themeSong.url || '').trim(),
            cover: String(themeSong.cover || '').trim(),
            duration: String(themeSong.duration || '').slice(0, 10)
          };
        }
      }

      const updatedUser = {
        ...user,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await redis.set(userKey, JSON.stringify(updatedUser));

      delete updatedUser.password;

      return res.json({ success: true, user: updatedUser });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'watch-time') {
    // ===== UPDATE WATCH TIME & LEVEL (dulu: api/v1/user/watch-time.js) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
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

      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      const { watchTime } = req.body; // watchTime in seconds

      if (!watchTime || watchTime < 0) {
        return res.status(400).json({ error: 'Invalid watch time' });
      }

      // Update watch time
      const currentWatchTime = user.watchTime || 0;
      const newWatchTime = currentWatchTime + watchTime;

      // Calculate level (1 level per 10 minutes = 600 seconds)
      const oldLevel = Math.floor(currentWatchTime / 600);
      const newLevel = Math.floor(newWatchTime / 600);
      const levelUp = newLevel > oldLevel;

      // Update user data
      user.watchTime = newWatchTime;
      user.level = newLevel;
      user.lastWatchUpdate = new Date().toISOString();

      // Check for title updates
      const titles = await getTitles();
      let newTitle = user.title || 'Anime Newbie';
      let titleLevel = user.titleLevel || 0;

      for (const title of titles) {
        if (newLevel >= title.level && title.level > titleLevel) {
          newTitle = title.name;
          titleLevel = title.level;
        }
      }

      user.title = newTitle;
      user.titleLevel = titleLevel;

      // Save to Redis
      await redis.set(`user:${userId}`, JSON.stringify(user));

      // Update leaderboard
      await redis.zadd('leaderboard', { score: newWatchTime, member: userId });

      res.json({
        success: true,
        level: newLevel,
        levelUp: levelUp,
        oldLevel: oldLevel,
        watchTime: newWatchTime,
        title: newTitle,
        titleChanged: newTitle !== user.title
      });
    } catch (error) {
      console.error('Watch time error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'streak') {
    // ===== DAILY STREAK & REWARD HARIAN =====
    // GET  -> lihat status streak saat ini (tanpa mengubah apa pun)
    // POST -> klaim hadiah harian (streak +1 kalau lanjut dari kemarin, XP bonus masuk ke watchTime/level)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyToken(req);
      const streakKey = `streak:${userId}`;

      const raw = await redis.get(streakKey);
      const streak = safeParse(raw) || { count: 0, longest: 0, lastCheckIn: null, totalCheckIns: 0 };

      const today = nowWIB().toISOString().slice(0, 10);
      const alreadyCheckedIn = streak.lastCheckIn === today;

      if (req.method === 'GET') {
        return res.json({
          success: true,
          streak: {
            count: streak.count,
            longest: streak.longest,
            totalCheckIns: streak.totalCheckIns,
            lastCheckIn: streak.lastCheckIn
          },
          alreadyCheckedIn,
          // Preview bonus kalau streak lanjut (estimasi, asumsi tetap konsisten)
          nextBonusSeconds: getStreakBonusSeconds(streak.count + 1)
        });
      }

      // ===== POST: klaim hadiah harian =====
      if (alreadyCheckedIn) {
        return res.status(409).json({
          success: false,
          error: 'Sudah klaim hari ini',
          alreadyCheckedIn: true,
          streak: {
            count: streak.count,
            longest: streak.longest,
            totalCheckIns: streak.totalCheckIns,
            lastCheckIn: streak.lastCheckIn
          }
        });
      }

      // Streak lanjut kalau check-in terakhir persis kemarin, kalau tidak reset ke 1
      const isConsecutive = streak.lastCheckIn && dayDiff(streak.lastCheckIn, today) === 1;
      const newCount = isConsecutive ? streak.count + 1 : 1;
      const newLongest = Math.max(streak.longest || 0, newCount);
      const newTotalCheckIns = (streak.totalCheckIns || 0) + 1;

      const bonusSeconds = getStreakBonusSeconds(newCount);
      const milestoneReached = [7, 30, 100].includes(newCount);

      const updatedStreak = {
        count: newCount,
        longest: newLongest,
        lastCheckIn: today,
        totalCheckIns: newTotalCheckIns
      };
      await redis.set(streakKey, JSON.stringify(updatedStreak));

      // ===== Terapkan bonus XP ke watchTime/level user (pakai logika sama dgn action 'watch-time') =====
      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

      const currentWatchTime = user.watchTime || 0;
      const newWatchTime = currentWatchTime + bonusSeconds;
      const oldLevel = Math.floor(currentWatchTime / 600);
      const newLevel = Math.floor(newWatchTime / 600);
      const levelUp = newLevel > oldLevel;

      user.watchTime = newWatchTime;
      user.level = newLevel;
      user.lastWatchUpdate = new Date().toISOString();

      const titles = await getTitles();
      let newTitle = user.title || 'Anime Newbie';
      let titleLevel = user.titleLevel || 0;
      for (const title of titles) {
        if (newLevel >= title.level && title.level > titleLevel) {
          newTitle = title.name;
          titleLevel = title.level;
        }
      }
      user.title = newTitle;
      user.titleLevel = titleLevel;

      await redis.set(`user:${userId}`, JSON.stringify(user));
      await redis.zadd('leaderboard', { score: newWatchTime, member: userId });

      return res.json({
        success: true,
        streak: updatedStreak,
        bonusSeconds,
        milestoneReached,
        level: newLevel,
        levelUp,
        watchTime: newWatchTime,
        title: newTitle
      });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Streak error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'class') {
    // ===== CLASS / ROLE RPG =====
    // GET  -> lihat daftar class + class yang sedang dipakai user
    // POST -> pilih/ganti class { classId }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    try {
      const userId = verifyToken(req);

      if (req.method === 'GET') {
        const userData = await redis.get(`user:${userId}`);
        const user = userData ? (typeof userData === 'string' ? JSON.parse(userData) : userData) : null;
        return res.json({ success: true, classes: CLASSES, currentClass: user?.classId || null });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const classId = body?.classId;
      if (!CLASSES.some((c) => c.id === classId)) {
        return res.status(400).json({ error: 'Class tidak valid' });
      }

      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      user.classId = classId;
      await redis.set(`user:${userId}`, JSON.stringify(user));

      return res.json({ success: true, currentClass: classId });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'guild') {
    // ===== GUILD / PARTY RPG =====
    // GET  -> lihat daftar guild + guild yang sedang diikuti user
    // POST -> gabung/pindah guild { guildId }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    try {
      const userId = verifyToken(req);

      if (req.method === 'GET') {
        const userData = await redis.get(`user:${userId}`);
        const user = userData ? (typeof userData === 'string' ? JSON.parse(userData) : userData) : null;
        return res.json({ success: true, guilds: GUILDS, currentGuild: user?.guildId || null });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const result = await setUserGuild(redis, userId, body?.guildId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.json({ success: true, currentGuild: result.guildId });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Guild error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (sub === 'history') {
    // ===== GET USER HISTORY + CHATS (dulu: api/v1/user/[id]/history.js) =====
    // Diakses lewat /api/v1/user/:id/history (lihat rewrite di vercel.json,
    // yang mengirim id lewat `action` dan menambahkan `sub=history`).
    const id = action;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      console.log(`🔍 Fetching user: ${id}`);

      // Cek apakah user exists
      const userData = await redis.get(`user:${id}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }

      // ===== AMBIL HISTORY ANIME & MANGA =====
      const historyKey = `history:${id}`;
      const history = (await redis.lrange(historyKey, 0, -1)) || [];

      const parsedHistory = history
        .map(safeParse)
        .filter(Boolean)
        .map(item => ({
          type: item.type,
          animeId: item.animeId,
          animeTitle: item.animeTitle || item.title,
          image_cover: item.image_cover,
          image_poster: item.image_poster,
          genre: item.genre,
          status: item.status,
          year: item.year,
          timestamp: item.timestamp,
          currentEpisode: item.currentEpisode || null,
          currentChapter: item.currentChapter || null
        }));

      // ===== DEDUPLIKASI HISTORY =====
      const seen = new Set();
      const uniqueHistory = [];

      for (const item of parsedHistory) {
        if (item.animeId && !seen.has(item.animeId)) {
          seen.add(item.animeId);
          uniqueHistory.push(item);
        }
      }

      // ===== AMBIL CHAT HISTORY DARI GLOBAL CHAT =====
      const chatMessages = await redis.lrange('chat:messages', 0, 99);
      const userChats = chatMessages
        .map(safeParse)
        .filter(Boolean)
        .filter(msg => msg.userId === id)
        .map(msg => ({
          id: msg.id,
          message: msg.message,
          timestamp: msg.timestamp,
          isCommand: msg.isCommand || false,
          hasImage: msg.hasImage || false,
          imageUrl: msg.imageUrl || null,
          title: msg.title || null,
          hasMedia: msg.hasMedia || false,
          mediaType: msg.mediaType || null,
          mediaUrl: msg.mediaUrl || null,
          fileName: msg.fileName || null,
          nsfw: msg.nsfw ?? msg.isNsfw ?? false,
          sfw: msg.sfw || false
        }))
        .slice(0, 20); // Ambil 20 chat terakhir

      // Parse user data
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      delete user.password;

      console.log(`✅ User found: ${user.name}, history: ${uniqueHistory.length}, chats: ${userChats.length}`);

      res.json({
        success: true,
        user: user,
        history: uniqueHistory.slice(0, 20), // Last 20 unique history
        chats: userChats
      });
    } catch (error) {
      console.error('❌ Get user history error:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  } else if (action === 'birthdate') {
    // ===== ATUR TANGGAL LAHIR (SEKALI KONFIRMASI, TERKUNCI SELAMANYA) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    try {
      const userId = verifyToken(req);
      const userKeyStr = `user:${userId}`;
      const userDataRaw = await redis.get(userKeyStr);
      if (!userDataRaw) {
        return res.status(401).json({ error: 'User not found' });
      }
      const user = typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw;

      if (req.method === 'GET') {
        return res.json({
          success: true,
          birthDate: user.birthDate || null,
          confirmed: !!user.birthDateConfirmed
        });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      if (user.birthDateConfirmed) {
        return res.status(400).json({ error: 'Tanggal lahir sudah dikonfirmasi dan tidak bisa diubah lagi' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const { birthDate, confirm } = body || {};

      if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return res.status(400).json({ error: 'Format tanggal lahir tidak valid (YYYY-MM-DD)' });
      }

      const parsed = new Date(`${birthDate}T00:00:00Z`);
      const now = new Date();
      if (isNaN(parsed.getTime()) || parsed.getTime() > now.getTime()) {
        return res.status(400).json({ error: 'Tanggal lahir tidak valid' });
      }
      const age = now.getUTCFullYear() - parsed.getUTCFullYear();
      if (age > 120 || age < 5) {
        return res.status(400).json({ error: 'Tanggal lahir tidak masuk akal' });
      }

      user.birthDate = birthDate;
      if (confirm === true) {
        user.birthDateConfirmed = true;
      }
      await redis.set(userKeyStr, JSON.stringify(user));

      return res.json({
        success: true,
        birthDate: user.birthDate,
        confirmed: !!user.birthDateConfirmed
      });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Birthdate error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'birthday-today') {
    // ===== SIAPA SAJA YANG ULANG TAHUN HARI INI (buat banner di Home) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Viewer opsional (guest tetap boleh lihat banner, cuma nggak bisa ngucapin/klaim)
      let viewerId = null;
      try { viewerId = verifyToken(req); } catch { viewerId = null; }

      const md = todayMonthDay();
      const year = currentYear();

      const keys = await scanUserKeys(5000);
      const userKeys = keys.filter((key) => !key.includes('email:'));
      if (!userKeys.length) {
        return res.json({ success: true, birthdays: [] });
      }

      const chunks = [];
      for (let i = 0; i < userKeys.length; i += 500) {
        chunks.push(userKeys.slice(i, i + 500));
      }
      const values = [];
      for (const chunk of chunks) {
        const result = await redis.mget(...chunk);
        values.push(...result);
      }

      const celebrants = [];
      for (const raw of values) {
        if (!raw) continue;
        const u = safeParse(raw);
        if (!u || !u.id || !u.birthDate || !u.birthDateConfirmed) continue;
        if (u.birthDate.slice(5, 10) !== md) continue;
        celebrants.push(u);
      }

      let wishedSet = new Set();
      if (viewerId && celebrants.length) {
        const wishKeys = celebrants.map((u) => `bday:wishers:${u.id}:${year}`);
        const memberChecks = await Promise.all(wishKeys.map((k) => redis.sismember(k, viewerId)));
        celebrants.forEach((u, i) => {
          if (memberChecks[i]) wishedSet.add(u.id);
        });
      }

      const birthdays = await Promise.all(celebrants.map(async (u) => {
        const isSelf = viewerId === u.id;
        let wishCount;
        if (isSelf) {
          wishCount = await redis.llen(`bday:messages:${u.id}:${year}`).catch(() => 0);
        }
        return {
          id: u.id,
          name: u.name,
          picture: u.picture || null,
          title: u.title || null,
          isSelf,
          alreadyWished: wishedSet.has(u.id),
          giftClaimed: isSelf ? (u.lastBirthdayGiftYear === year) : undefined,
          wishCount: isSelf ? (wishCount || 0) : undefined
        };
      }));

      return res.json({ success: true, birthdays });
    } catch (error) {
      console.error('Birthday-today error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'birthday-wish') {
    // ===== KIRIM UCAPAN ULANG TAHUN KE USER LAIN (dapat XP) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const giverId = verifyToken(req);

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const targetId = body?.userId;
      if (!targetId) {
        return res.status(400).json({ error: 'userId wajib diisi' });
      }
      if (targetId === giverId) {
        return res.status(400).json({ error: 'Kamu tidak bisa mengucapkan ulang tahun ke diri sendiri' });
      }

      let message = typeof body?.message === 'string' ? body.message.trim() : '';
      if (message.length > 200) {
        return res.status(400).json({ error: 'Ucapan maksimal 200 karakter' });
      }

      const targetRaw = await redis.get(`user:${targetId}`);
      if (!targetRaw) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
      }
      const target = safeParse(targetRaw);
      if (!target?.birthDateConfirmed || target.birthDate.slice(5, 10) !== todayMonthDay()) {
        return res.status(400).json({ error: 'User ini sedang tidak berulang tahun hari ini' });
      }

      const giverRaw = await redis.get(`user:${giverId}`);
      const giver = safeParse(giverRaw);

      const year = currentYear();
      const wishKey = `bday:wishers:${targetId}:${year}`;
      const alreadyWished = await redis.sismember(wishKey, giverId);
      if (alreadyWished) {
        return res.status(409).json({ error: 'Kamu sudah mengucapkan selamat ke orang ini tahun ini' });
      }

      await redis.sadd(wishKey, giverId);
      await redis.expire(wishKey, 400 * 24 * 60 * 60); // bersih-bersih otomatis ~400 hari

      // Simpan pesannya biar bisa dibaca sama yang ulang tahun (lihat action 'birthday-messages')
      const messagesKey = `bday:messages:${targetId}:${year}`;
      await redis.rpush(messagesKey, JSON.stringify({
        fromId: giverId,
        fromName: giver?.name || 'Sobat Ndichan',
        fromPicture: giver?.picture || null,
        message: message || null,
        at: new Date().toISOString()
      }));
      await redis.expire(messagesKey, 400 * 24 * 60 * 60);

      const result = await grantBirthdayXp(giverId, BIRTHDAY_WISH_REWARD);
      if (!result) {
        return res.status(401).json({ error: 'User not found' });
      }

      return res.json({
        success: true,
        reward: BIRTHDAY_WISH_REWARD,
        level: result.level,
        title: result.title
      });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Birthday-wish error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'birthday-messages') {
    // ===== LIHAT UCAPAN ULANG TAHUN YANG DITERIMA TAHUN INI =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyToken(req);
      const year = req.query.year ? parseInt(req.query.year, 10) : currentYear();
      const raw = await redis.lrange(`bday:messages:${userId}:${year}`, 0, -1);
      const messages = (raw || [])
        .map((item) => safeParse(item))
        .filter(Boolean)
        .reverse(); // paling baru duluan

      return res.json({ success: true, messages, year });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Birthday-messages error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'birthday-claim') {
    // ===== KLAIM HADIAH ULANG TAHUN SENDIRI (sekali per tahun) =====
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyToken(req);
      const userKeyStr = `user:${userId}`;
      const userDataRaw = await redis.get(userKeyStr);
      if (!userDataRaw) {
        return res.status(401).json({ error: 'User not found' });
      }
      const user = typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw;

      if (!user.birthDateConfirmed || user.birthDate.slice(5, 10) !== todayMonthDay()) {
        return res.status(400).json({ error: 'Bukan hari ulang tahunmu' });
      }

      const year = currentYear();
      if (user.lastBirthdayGiftYear === year) {
        return res.status(409).json({ error: 'Hadiah ulang tahun tahun ini sudah kamu klaim' });
      }

      user.lastBirthdayGiftYear = year;
      await redis.set(userKeyStr, JSON.stringify(user));

      const result = await grantBirthdayXp(userId, BIRTHDAY_GIFT_REWARD);
      await addItem(redis, userId, BIRTHDAY_GIFT_ITEM, 1);

      return res.json({
        success: true,
        reward: BIRTHDAY_GIFT_REWARD,
        item: BIRTHDAY_GIFT_ITEM,
        level: result?.level,
        title: result?.title
      });
    } catch (error) {
      if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.error('Birthday-claim error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // ===== GET USER BY ID (dulu: api/v1/user/[id].js) =====
    const id = action;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      console.log(`🔍 Fetching user: ${id}`);

      // Get user data dari Redis
      const userData = await redis.get(`user:${id}`);
      if (!userData) {
        console.log(`❌ User not found: ${id}`);
        return res.status(404).json({ error: 'User not found' });
      }

      // Parse user data
      let user;
      try {
        user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return res.status(500).json({ error: 'Invalid user data' });
      }

      // Hapus password
      delete user.password;

      // ===== CEK ADMIN =====
      let isAdmin = false;
      try {
        // Cek dari Redis admin:ids
        const adminData = await redis.get('admin:ids');
        if (adminData) {
          const adminIds = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
          if (Array.isArray(adminIds)) {
            isAdmin = adminIds.includes(id);
          }
        }
        // Cek dari SUPER_ADMIN_IDS
        if (!isAdmin) {
          isAdmin = SUPER_ADMIN_IDS.includes(id);
        }
      } catch (error) {
        console.error('Error checking admin:', error);
      }
      user.isAdmin = isAdmin;

      // ===== GET HISTORY =====
      let history = [];
      try {
        const historyData = await redis.get(`history:${id}`);
        if (historyData) {
          history = typeof historyData === 'string' ? JSON.parse(historyData) : historyData;
          if (!Array.isArray(history)) {
            history = [];
          }
          // Filter history yang valid
          history = history.filter(item => item && typeof item === 'object' && item.animeId);
        }
      } catch (error) {
        console.error('Error parsing history:', error);
        history = [];
      }

      console.log(`✅ User found: ${user.name}, isAdmin: ${isAdmin}, history: ${history.length}`);

      res.json({
        success: true,
        user: user,
        history: history.slice(0, 10) // Last 10 history
      });
    } catch (error) {
      console.error('❌ Get user error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}
