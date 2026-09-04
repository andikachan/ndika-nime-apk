import redis from './redis.js';

// redis singleton from ./redis.js

function safeJSONParse(data) {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Notify JSON parse error:', error.message);
    return null;
  }
}

// ===== HELPER: Ambil semua user (dipakai buat kirim notifikasi ke semua orang) =====
export async function getAllUsers() {
  const keys = await redis.keys('user:*');
  const userKeys = keys.filter((key) => !key.includes('email:'));
  if (userKeys.length === 0) return [];

  const values = await redis.mget(...userKeys);
  const users = [];
  for (const raw of values) {
    if (!raw) continue;
    const user = safeJSONParse(raw);
    if (user && user.id) users.push(user);
  }
  return users;
}

// ===== EMAIL YANG DIKECUALIKAN DARI NOTIFIKASI =====
// Disimpan sebagai Redis SET biar gampang add/remove dan otomatis unik.
const EXCLUDED_KEY = 'notif:excluded';

export async function listExcludedEmails() {
  const members = await redis.smembers(EXCLUDED_KEY);
  return (members || []).slice().sort();
}

export async function getExcludedEmailSet() {
  const members = await redis.smembers(EXCLUDED_KEY);
  return new Set((members || []).map((e) => String(e).toLowerCase()));
}

export async function addExcludedEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) {
    throw new Error('Email tidak valid');
  }
  await redis.sadd(EXCLUDED_KEY, clean);
  return listExcludedEmails();
}

export async function removeExcludedEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  await redis.srem(EXCLUDED_KEY, clean);
  return listExcludedEmails();
}

// ===== STATUS "TERAKHIR DINOTIFIKASI" (buat ditampilkan di panel admin) =====
const LAST_KEY = (type) => `notif:last:${type}`;

export async function getLastNotified(type) {
  const raw = await redis.get(LAST_KEY(type));
  return safeJSONParse(raw);
}

export async function setLastNotified(type, info) {
  await redis.set(LAST_KEY(type), JSON.stringify(info));
}

// ===== JUDUL/CHAPTER YANG SUDAH PERNAH DINOTIFIKASI (dedup buat cron) =====
// null = belum pernah diinisialisasi sama sekali (dipakai buat bootstrap
// supaya run pertama kali tidak nge-broadcast seluruh isi list ke semua orang).
const SEEN_KEY = (type) => `notif:seen:${type}`;
const MAX_SEEN_TRACKED = 500;

export async function getSeenIds(type) {
  const raw = await redis.get(SEEN_KEY(type));
  if (raw === null || raw === undefined) return null;
  const parsed = safeJSONParse(raw);
  if (!Array.isArray(parsed)) return null;
  return new Set(parsed.map(String));
}

export async function saveSeenIds(type, idsArray) {
  const unique = Array.from(new Set(idsArray.map(String)));
  const trimmed = unique.slice(-MAX_SEEN_TRACKED);
  await redis.set(SEEN_KEY(type), JSON.stringify(trimmed));
}

// ===== TEMPLATE EMAIL NOTIFIKASI RILIS ANIME/KOMIK BARU =====
// Senada dengan template verifikasi email yang sudah ada (dark theme + aksen emas).
export function buildNotifyEmailHtml({ type, title, image, episode, url, name }) {
  const label = type === 'komik' ? 'Komik' : 'Anime';
  const safeTitle = title || '';
  const safeName = name || 'Sobat Ndichan';
  const ctaUrl = url || 'https://ndichan.xyz';
  const posterImg = image
    ? `<img src="${image}" alt="${safeTitle}" style="width:100%;max-width:220px;border-radius:16px;display:block;margin:0 auto 20px;box-shadow:0 10px 30px rgba(0,0,0,0.6);" />`
    : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ndichan - ${label} Baru</title>
  </head>
  <body style="background-color:#0a0a0c;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
    <div style="max-width:560px;margin:40px auto;background:linear-gradient(145deg,#16161a,#1a1a1e);border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
      <div style="background:linear-gradient(135deg,#0a0a0c 0%,#16161a 100%);padding:30px 30px 20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
        <h1 style="margin:0;font-size:26px;font-weight:800;background:linear-gradient(135deg,#F6CF80,#f0b84d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.5px;">Ndichan</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.4);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">${label} Baru Sudah Rilis!</p>
      </div>
      <div style="padding:36px 30px;text-align:center;">
        <p style="font-size:16px;color:rgba(255,255,255,0.5);margin:0 0 20px;">Halo <span style="color:#F6CF80;font-weight:700;">${safeName}</span>, ada update buat kamu 👀</p>
        ${posterImg}
        <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0 0 6px;">${safeTitle}</p>
        ${episode ? `<p style="font-size:13px;color:#F6CF80;font-weight:700;margin:0 0 20px;">${episode}</p>` : '<div style="margin-bottom:20px;"></div>'}
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#F6CF80,#f0b84d);color:#0a0a0c;font-weight:800;font-size:14px;padding:12px 32px;border-radius:999px;text-decoration:none;">Tonton / Baca Sekarang</a>
        <p style="margin-top:28px;color:rgba(255,255,255,0.2);font-size:11px;">Kamu menerima email ini karena terdaftar di Ndichan. Email ini dikirim otomatis oleh sistem. Tidak mau dapat email ini lagi? Hubungi admin Ndichan.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}
