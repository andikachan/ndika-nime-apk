import redis from './redis.js';

// redis singleton from ./redis.js

function safeJSONParse(data) {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Backup JSON parse error:', error.message);
    return null;
  }
}

// ===== PENGATURAN BOT TELEGRAM (token + chat id tujuan) =====
// Token TIDAK PERNAH dikembalikan utuh ke client lewat endpoint admin (lihat
// admin/[...action].js action 'backup'), cuma dipakai di server buat kirim
// dokumen. Kalau field `botToken` dikirim kosong saat save, token lama tetap
// dipertahankan (supaya admin tidak perlu ketik ulang tiap kali cuma mau
// ganti chat ID tujuan).
const TELEGRAM_SETTINGS_KEY = 'backup:telegram_settings';

export async function getTelegramSettings() {
  const raw = await redis.get(TELEGRAM_SETTINGS_KEY);
  return safeJSONParse(raw) || { botToken: '', chatId: '' };
}

export async function saveTelegramSettings({ botToken, chatId }) {
  const current = await getTelegramSettings();
  const settings = {
    botToken: botToken !== undefined && botToken !== null && String(botToken).trim() !== ''
      ? String(botToken).trim()
      : current.botToken,
    chatId: chatId !== undefined && chatId !== null
      ? String(chatId).trim()
      : current.chatId,
  };
  await redis.set(TELEGRAM_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

// ===== STATUS BACKUP TERAKHIR (ditampilkan di panel admin) =====
const LAST_BACKUP_KEY = 'backup:last';

export async function getLastBackupInfo() {
  const raw = await redis.get(LAST_BACKUP_KEY);
  return safeJSONParse(raw);
}

export async function setLastBackupInfo(info) {
  await redis.set(LAST_BACKUP_KEY, JSON.stringify(info));
}

// ===== DUMP SEMUA KEY REDIS =====
// Key notifikasi punya sendiri (notif:seen:*) sengaja TIDAK dikecualikan —
// biar restore benar-benar mengembalikan seluruh state, termasuk dedup cron.
async function listAllKeys() {
  return redis.keys('*');
}

async function dumpKey(key) {
  const type = await redis.type(key);
  if (!type || type === 'none') return null;

  const ttl = await redis.ttl(key); // -1 = tidak ada expiry, -2 = key tidak ada

  let value;
  switch (type) {
    case 'string':
      value = await redis.get(key);
      break;
    case 'hash':
      value = await redis.hgetall(key);
      break;
    case 'list':
      value = await redis.lrange(key, 0, -1);
      break;
    case 'set':
      value = await redis.smembers(key);
      break;
    case 'zset': {
      // Upstash mengembalikan array datar: [member1, score1, member2, score2, ...]
      const flat = await redis.zrange(key, 0, -1, { withScores: true });
      const pairs = [];
      for (let i = 0; i < flat.length; i += 2) {
        pairs.push({ member: flat[i], score: flat[i + 1] });
      }
      value = pairs;
      break;
    }
    default:
      // Tipe yang belum didukung (misal stream) dilewati saja, tidak bikin gagal semua.
      return null;
  }

  return { key, type, value, ttl: ttl > 0 ? ttl : null };
}

export async function buildFullBackup() {
  const keys = await listAllKeys();
  const entries = [];

  // Proses per-chunk supaya tidak bikin ratusan/ribuan request paralel sekaligus.
  const CHUNK = 25;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map((k) => dumpKey(k)));
    entries.push(...results.filter(Boolean));
  }

  return {
    exportedAt: new Date().toISOString(),
    totalKeys: entries.length,
    entries,
  };
}

// ===== HAPUS SEMUA KEY (buat fitur "Reset Semua Database") =====
export async function wipeAllKeys() {
  const keys = await listAllKeys();
  const CHUNK = 100;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    await Promise.all(chunk.map((k) => redis.del(k)));
    deleted += chunk.length;
  }
  return { deleted, totalKeys: keys.length };
}

// ===== RESTORE SEMUA KEY DARI FILE BACKUP =====
export async function restoreFromBackup(backup, { wipeBefore = false } = {}) {
  if (!backup || !Array.isArray(backup.entries)) {
    throw new Error('Format backup tidak valid');
  }

  if (wipeBefore) {
    await wipeAllKeys();
  }

  let restored = 0;
  let failed = 0;

  for (const entry of backup.entries) {
    try {
      const { key, type, value, ttl } = entry || {};
      if (!key || !type) {
        failed++;
        continue;
      }

      switch (type) {
        case 'string':
          await redis.set(key, value);
          break;

        case 'hash':
          await redis.del(key);
          if (value && Object.keys(value).length > 0) {
            await redis.hset(key, value);
          }
          break;

        case 'list':
          await redis.del(key);
          if (Array.isArray(value) && value.length > 0) {
            await redis.rpush(key, ...value);
          }
          break;

        case 'set':
          await redis.del(key);
          if (Array.isArray(value) && value.length > 0) {
            await redis.sadd(key, ...value);
          }
          break;

        case 'zset':
          await redis.del(key);
          if (Array.isArray(value) && value.length > 0) {
            const members = value
              .filter((v) => v && v.member !== undefined && v.score !== undefined)
              .map((v) => ({ score: v.score, member: v.member }));
            if (members.length > 0) {
              await redis.zadd(key, ...members);
            }
          }
          break;

        default:
          failed++;
          continue;
      }

      if (ttl && ttl > 0) {
        await redis.expire(key, ttl);
      }

      restored++;
    } catch (error) {
      console.error('Restore key error:', entry?.key, error.message);
      failed++;
    }
  }

  return { restored, failed, total: backup.entries.length };
}

// ===== KIRIM FILE BACKUP VIA TELEGRAM BOT =====
export async function sendBackupToTelegram(backupData, { botToken, chatId }) {
  if (!botToken || !chatId) {
    throw new Error('Bot token dan chat ID Telegram belum diatur');
  }

  const json = JSON.stringify(backupData);
  const filename = `ndichan-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append(
    'caption',
    `Backup Redis Ndichan\nTotal key: ${backupData.totalKeys}\nWaktu: ${backupData.exportedAt}`
  );
  form.append('document', new Blob([json], { type: 'application/json' }), filename);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.description || 'Gagal mengirim backup ke Telegram');
  }

  return data;
}
