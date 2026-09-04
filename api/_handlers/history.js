import { getJwtSecret, verifyToken } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { bumpQuestProgress } from '../_lib/quests.js';

// redis singleton from _lib/redis.js

const safeParse = (item) => {
  try {
    if (!item) return null;
    if (typeof item === 'object') return item;
    return JSON.parse(item);
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const userId = verifyToken(req);
    const historyKey = `history:${userId}`;

    // ======================
    // GET HISTORY
    // ======================
    if (req.method === 'GET') {
      const history = (await redis.lrange(historyKey, 0, -1)) || [];

      const seen = new Set();
      const uniqueHistory = [];

      for (const item of history) {
        const parsed = safeParse(item);
        if (parsed && parsed.animeId) {
          const type = parsed.type || 'anime';
          const dedupKey = `${type}:${parsed.animeId}`;

          if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            uniqueHistory.push({
              type,
              animeId: parsed.animeId,
              animeTitle: parsed.animeTitle || parsed.title,
              image_cover: parsed.image_cover,
              image_poster: parsed.image_poster,
              status: parsed.status,
              genre: parsed.genre,
              year: parsed.year,
              timestamp: parsed.timestamp,
              currentEpisode: parsed.currentEpisode || null,
              currentChapter: parsed.currentChapter || null
            });
          }
        }
      }

      return res.json({ data: uniqueHistory });
    }

    // ======================
    // POST HISTORY
    // ======================
    if (req.method === 'POST') {
      let body = req.body;

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }

      const {
        type = 'anime', // 'anime' | 'manga'
        animeId,
        title,
        image_cover,
        image_poster,
        currentEpisode, // anime: { index, ... }
        currentChapter, // manga: { chapter, slug }
        status,
        genre,
        year
      } = body || {};

      if (!animeId || !title) {
        return res.status(400).json({
          error: 'type, animeId, title required'
        });
      }

      const rawExisting = (await redis.lrange(historyKey, 0, -1)) || [];

      const newEntry = {
        type,
        animeId,
        animeTitle: title,
        image_cover: image_cover || null,
        image_poster: image_poster || image_cover || null,
        currentEpisode: currentEpisode || null,
        currentChapter: currentChapter || null,
        status: status || null,
        genre: genre || null,
        year: year || null,
        timestamp: new Date().toISOString()
      };

      // ===== HAPUS ENTRI LAMA UNTUK type+animeId INI (AMAN/ATOMIC) =====
      // FIX: sebelumnya di sini kita `redis.del(historyKey)` lalu `rpush` ulang
      // seluruh list. Itu artinya ada jeda di mana key BENAR-BENAR KOSONG, dan
      // kalau request ini gagal/timeout pas di antara del & rpush (koneksi
      // Upstash flaky, function timeout, dll), seluruh history user langsung
      // hilang permanen. Pola itu juga rawan race condition: kalau ada 2
      // request POST nyaris bersamaan (ganti episode cepat / 2 tab), yang
      // selesai belakangan bakal menimpa hasil yang duluan → entri baru bisa
      // lenyap tanpa jejak.
      //
      // Sekarang kita cuma menghapus item lama yang cocok satu-satu pakai
      // LREM (perintah atomic, gak pernah mengosongkan seluruh key), lalu
      // LPUSH entri baru, lalu LTRIM buat jaga maksimal 50 entri. Key tidak
      // pernah berada dalam kondisi "kosong total" di titik manapun.
      for (const raw of rawExisting) {
        const parsed = safeParse(raw);
        if (parsed && (parsed.type || 'anime') === type && parsed.animeId === animeId) {
          await redis.lrem(historyKey, 0, raw);
        }
      }

      await redis.lpush(historyKey, JSON.stringify(newEntry));
      await redis.ltrim(historyKey, 0, 49);

      // ===== QUEST: bump progress nonton episode / baca chapter =====
      // Cuma dihitung kalau memang lagi nonton episode spesifik atau baca chapter
      // spesifik (bukan sekadar buka halaman detail anime/komik).
      if (type === 'anime' && currentEpisode) {
        await bumpQuestProgress(redis, userId, 'watch_episode', 1);
      } else if (type === 'manga' && currentChapter) {
        await bumpQuestProgress(redis, userId, 'read_chapter', 1);
      }

      const finalRaw = (await redis.lrange(historyKey, 0, -1)) || [];
      const finalHistory = finalRaw.map(safeParse).filter(Boolean);

      const seen = new Set();
      const uniqueData = [];
      for (const item of finalHistory) {
        const dedupKey = `${item.type || 'anime'}:${item.animeId}`;
        if (item && item.animeId && !seen.has(dedupKey)) {
          seen.add(dedupKey);
          uniqueData.push(item);
        }
      }

      return res.json({
        success: true,
        data: uniqueData,
      });
    }

    // ======================
    // DELETE HISTORY
    // Body/query kosong          -> hapus semua riwayat
    // { animeId }                -> hapus satu item (semua tipe dgn id itu)
    // { animeId, type }          -> hapus satu item spesifik tipe
    // ======================
    if (req.method === 'DELETE') {
      let body = req.body;

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const animeId = body?.animeId || req.query?.animeId;
      const itemType = body?.type || req.query?.type;

      // ===== HAPUS SATU ITEM (AMAN/ATOMIC, lihat catatan fix di POST) =====
      if (animeId) {
        const rawExisting = (await redis.lrange(historyKey, 0, -1)) || [];

        for (const raw of rawExisting) {
          const parsed = safeParse(raw);
          if (
            parsed &&
            parsed.animeId === animeId &&
            (!itemType || (parsed.type || 'anime') === itemType)
          ) {
            await redis.lrem(historyKey, 0, raw);
          }
        }

        const finalRaw = (await redis.lrange(historyKey, 0, -1)) || [];
        const history = finalRaw.map(safeParse).filter(Boolean);

        return res.json({ success: true, data: history });
      }

      // ===== HAPUS SEMUA =====
      await redis.del(historyKey);
      return res.json({ success: true, data: [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (
      error.message === 'No token' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.error('History error:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
