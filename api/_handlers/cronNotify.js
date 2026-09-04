import { getTransporter } from '../_lib/mailer.js';
import {
  buildNotifyEmailHtml,
  getAllUsers,
  getExcludedEmailSet,
  getSeenIds,
  saveSeenIds,
  setLastNotified,
} from '../_lib/notify.js';

// ===== NOTIFIKASI ANIME/KOMIK BARU — OTOMATIS LEWAT CRON =====
// Endpoint ini didesain buat dipanggil berkala oleh layanan cron eksternal
// (cron-job.org), BUKAN dari panel admin. Tidak ada lagi fitur kirim manual —
// tiap kali dipanggil, endpoint ini ngecek sumber data anime/komik terbaru,
// bandingin sama daftar yang sudah pernah dinotifikasi (disimpan di Redis),
// terus kirim email cuma buat judul/chapter yang belum pernah dinotifikasi.

const SITE_URL = 'https://ndichan.xyz';
const SOURCE_API = 'https://api.ndikacunk.my.id';

// Batas aman per run — kalau entah kenapa API sumber balikin lonjakan besar
// item "baru" sekaligus (misal abis maintenance/reset), jangan spam semua
// orang dengan puluhan email sekaligus dalam satu run.
const MAX_NEW_PER_RUN = 8;

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch gagal (${res.status}): ${url}`);
  return res.json();
}

async function broadcastNewItems(type, newItems) {
  const [allUsers, excluded] = await Promise.all([getAllUsers(), getExcludedEmailSet()]);
  const recipients = allUsers.filter(
    (u) => u.email && u.email.includes('@') && !excluded.has(u.email.toLowerCase())
  );

  if (recipients.length === 0) {
    return { sentCount: 0, failedCount: 0, recipients: 0 };
  }

  const { transporter, from } = await getTransporter();
  let sentCount = 0;
  let failedCount = 0;

  // Kirim per-item (bukan per-item-per-user paralel semua sekaligus) supaya
  // tidak ada satu batch fetch yang terlalu besar kalau kebetulan ada
  // beberapa rilisan baru dalam satu run.
  for (const item of newItems) {
    const subject = type === 'komik'
      ? `Komik Baru: ${item.title} sudah rilis di Ndichan!`
      : `Anime Baru: ${item.title} sudah rilis di Ndichan!`;

    const results = await Promise.allSettled(
      recipients.map((r) =>
        transporter.sendMail({
          from: `"Ndichan" <${from}>`,
          to: r.email,
          subject,
          html: buildNotifyEmailHtml({
            type,
            title: item.title,
            image: item.image,
            episode: item.episode,
            url: item.url,
            name: r.name,
          }),
        })
      )
    );

    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    sentCount += okCount;
    failedCount += results.length - okCount;

    await setLastNotified(type, {
      title: item.title,
      image: item.image || null,
      url: item.url || null,
      sentAt: new Date().toISOString(),
    });
  }

  return { sentCount, failedCount, recipients: recipients.length };
}

async function checkAnime() {
  const body = await fetchJson(`${SOURCE_API}/v1/new?page=1&limit=20`);
  const rawItems = Array.isArray(body?.data) ? body.data : [];

  const items = rawItems
    .filter((i) => i && i.id)
    .map((i) => ({
      id: String(i.id),
      title: i.title || '',
      image: i.image_poster || '',
      episode: '',
      url: `${SITE_URL}/anime/${i.id}-${slugify(i.title)}`,
    }));

  const seen = await getSeenIds('anime');
  const currentIds = items.map((i) => i.id);

  // Bootstrap: pertama kali dijalankan, seluruh isi "terbaru" saat ini bukan
  // benar-benar rilisan baru — cukup catat sebagai baseline, jangan kirim email.
  if (seen === null) {
    await saveSeenIds('anime', currentIds);
    return { bootstrapped: true, tracked: currentIds.length };
  }

  const newItems = items.filter((i) => !seen.has(i.id)).slice(0, MAX_NEW_PER_RUN);
  if (newItems.length === 0) {
    return { newCount: 0 };
  }

  const sendResult = await broadcastNewItems('anime', newItems);
  await saveSeenIds('anime', [...seen, ...newItems.map((i) => i.id)]);

  return { newCount: newItems.length, titles: newItems.map((i) => i.title), ...sendResult };
}

async function checkKomik() {
  const body = await fetchJson(`${SOURCE_API}/v1/manga/latest?limit=20`);
  const rawItems = Array.isArray(body?.data) ? body.data : [];

  const items = [];
  for (const m of rawItems) {
    const ch = m?.chapters?.[0];
    if (!m || !ch || !ch.slug) continue;
    items.push({
      // Kunci dedup pakai slug chapter (bukan slug manga), karena tiap
      // chapter baru dari judul yang sama tetap harus dianggap "rilisan baru".
      id: String(ch.slug),
      title: `${m.title || ''}${ch.chapterNum ? ` - Chapter ${ch.chapterNum}` : ''}`,
      image: m.cover || '',
      episode: ch.chapterNum ? `Chapter ${ch.chapterNum}` : '',
      url: `${SITE_URL}/baca/${ch.slug}`,
    });
  }

  const seen = await getSeenIds('komik');
  const currentIds = items.map((i) => i.id);

  if (seen === null) {
    await saveSeenIds('komik', currentIds);
    return { bootstrapped: true, tracked: currentIds.length };
  }

  const newItems = items.filter((i) => !seen.has(i.id)).slice(0, MAX_NEW_PER_RUN);
  if (newItems.length === 0) {
    return { newCount: 0 };
  }

  const sendResult = await broadcastNewItems('komik', newItems);
  await saveSeenIds('komik', [...seen, ...newItems.map((i) => i.id)]);

  return { newCount: newItems.length, titles: newItems.map((i) => i.title), ...sendResult };
}

export default async function handler(req, res) {
  // Proteksi pakai secret, karena endpoint ini dipanggil dari luar (cron-job.org)
  // tanpa cookie login admin. Set CRON_NOTIFY_SECRET di env Vercel, lalu pasang
  // URL cron: https://ndichan.xyz/api/v1/cron/notify?secret=<CRON_NOTIFY_SECRET>
  const secret = (req.query.secret || req.headers['x-cron-secret'] || '').toString();
  const expected = process.env.CRON_NOTIFY_SECRET;

  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = {};

  try {
    results.anime = await checkAnime();
  } catch (error) {
    console.error('Cron notify anime error:', error);
    results.anime = { error: error.message };
  }

  try {
    results.komik = await checkKomik();
  } catch (error) {
    console.error('Cron notify komik error:', error);
    results.komik = { error: error.message };
  }

  return res.json({ success: true, results });
}
