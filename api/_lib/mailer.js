import nodemailer from 'nodemailer';
import redis from './redis.js';

// redis singleton from ./redis.js

const SETTINGS_KEY = 'site:email-settings';

function safeJSONParse(data) {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Email settings JSON parse error:', error.message);
    return null;
  }
}

// ===== Ambil pengaturan email aktif =====
// Prioritas: yang disimpan admin lewat panel (Redis) -> fallback ke ENV vars.
// Password TIDAK PERNAH dikembalikan ke client lewat endpoint admin (lihat
// admin/[...action].js action 'mail-settings'), cuma dipakai di server buat
// kirim email.
export async function getEmailSettings() {
  const raw = await redis.get(SETTINGS_KEY);
  const parsed = safeJSONParse(raw);

  const user = (parsed?.user || process.env.GMAIL_USER || '').trim();
  return {
    user,
    pass: parsed?.pass || process.env.GMAIL_APP_PASSWORD || '',
    from: (parsed?.from || process.env.GMAIL_FROM || user || '').trim(),
    host: (parsed?.host || 'smtp.gmail.com').trim(),
    port: Number(parsed?.port) || 587,
  };
}

// ===== Simpan pengaturan email dari admin panel =====
// Kalau `pass` dikirim kosong/undefined, password lama tetap dipertahankan
// (supaya admin tidak perlu ketik ulang app password tiap kali cuma mau
// ganti alamat email pengirim, misalnya).
export async function saveEmailSettings({ user, pass, from, host, port }) {
  const current = await getEmailSettings();
  const updated = {
    user: user !== undefined && user !== null ? String(user).trim() : current.user,
    pass: pass !== undefined && pass !== null && String(pass).trim() !== '' ? String(pass).trim() : current.pass,
    from: from !== undefined && from !== null ? String(from).trim() : current.from,
    host: host !== undefined && host !== null && String(host).trim() !== '' ? String(host).trim() : current.host,
    port: port !== undefined && port !== null && Number(port) > 0 ? Number(port) : current.port,
  };
  await redis.set(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

let cachedTransporter = null;
let cachedKey = null;

// ===== Transporter nodemailer, dibangun dari pengaturan aktif =====
// Cache di-invalidate otomatis kalau kombinasi host/user/pass/port berubah
// (misal admin baru saja update pengaturan email dari panel).
export async function getTransporter() {
  const settings = await getEmailSettings();
  const key = `${settings.host}:${settings.port}:${settings.user}:${settings.pass}`;

  if (!cachedTransporter || cachedKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    });
    cachedKey = key;
  }

  return { transporter: cachedTransporter, from: settings.from || settings.user };
}
