import {
  buildFullBackup,
  getTelegramSettings,
  sendBackupToTelegram,
  setLastBackupInfo,
} from '../_lib/backup.js';

// ===== BACKUP REDIS OTOMATIS — DIPICU CRON EKSTERNAL =====
// Sama seperti /api/v1/cron/notify, endpoint ini didesain buat dipanggil
// berkala oleh cron-job.org (bukan dari panel admin). Tiap dipanggil, dia
// nge-dump seluruh key Redis lalu kirim hasilnya sebagai file .json ke chat
// Telegram yang sudah diatur admin di panel Backup & Restore.

export default async function handler(req, res) {
  const secret = (req.query.secret || req.headers['x-cron-secret'] || '').toString();
  const expected = process.env.CRON_BACKUP_SECRET;

  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settings = await getTelegramSettings();
    if (!settings.botToken || !settings.chatId) {
      const info = {
        success: false,
        error: 'Bot token / chat ID Telegram belum diatur di panel admin',
        sentAt: new Date().toISOString(),
      };
      await setLastBackupInfo(info);
      return res.status(400).json(info);
    }

    const backup = await buildFullBackup();
    await sendBackupToTelegram(backup, settings);

    const info = {
      success: true,
      totalKeys: backup.totalKeys,
      sentAt: new Date().toISOString(),
    };
    await setLastBackupInfo(info);

    return res.json(info);
  } catch (error) {
    console.error('Cron backup error:', error);
    const info = { success: false, error: error.message, sentAt: new Date().toISOString() };
    try { await setLastBackupInfo(info); } catch {}
    return res.status(500).json(info);
  }
}
