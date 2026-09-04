import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  GACHA_COSTS,
  getTodayWibDate,
  gachaStatsKey,
  userCardsKey,
  userDeckKey,
  getOrCreateGachaStats,
  rollSingleCard,
  addCardsToUser
} from '../_lib/cards.js';
import { CARDS_DATABASE, getCardById } from '../../src/utils/cardsData.js';
import { bumpQuestProgress } from '../_lib/quests.js';

// redis singleton from _lib/redis.js

// verifyUserId imported from _lib/auth.js

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== GET /api/v1/gacha/deck?userId=... (PUBLIC OR LOGGED IN) =====
  if (action === 'deck' && req.method === 'GET') {
    const queryUserId = req.query.userId || verifyUserId(req);
    if (!queryUserId) {
      return res.status(200).json({ success: true, deck: [] });
    }

    try {
      const rawDeck = await redis.get(userDeckKey(queryUserId));
      const cardIds = rawDeck ? (typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck) : [];
      
      const rawCards = await redis.get(userCardsKey(queryUserId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      const deck = cardIds
        .map((id) => {
          const base = getCardById(id);
          if (!base) return null;
          const userMeta = userCards[id] || { stars: 1, count: 1 };
          return {
            ...base,
            stars: userMeta.stars || 1,
            count: userMeta.count || 1
          };
        })
        .filter(Boolean);

      return res.status(200).json({ success: true, deck });
    } catch (e) {
      console.error('Gacha get deck error:', e);
      return res.status(500).json({ error: 'Gagal mengambil deck showcase' });
    }
  }

  // Semua aksi di bawah ini memerlukan user login
  const userId = verifyUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Harap login terlebih dahulu' });
  }

  try {
    const today = getTodayWibDate();

    // ===== 1. GET /api/v1/gacha/status =====
    if (action === 'status') {
      const stats = await getOrCreateGachaStats(redis, userId);
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
      const rawDeck = await redis.get(userDeckKey(userId));
      const deckIds = rawDeck ? (typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck) : [];

      const uniqueCardsCount = Object.keys(userCards).length;
      const totalCardsCount = Object.values(userCards).reduce((acc, c) => acc + (c.count || 1), 0);

      const canFreePull = stats.lastDailyFree !== today;
      const canClaimDaily = stats.lastDailyClaim !== today;

      return res.status(200).json({
        success: true,
        stats: {
          coins: stats.coins,
          tickets: stats.tickets,
          totalPulls: stats.totalPulls || 0,
          pitySr: stats.pitySr || 0,
          pityUr: stats.pityUr || 0,
          canFreePull,
          canClaimDaily,
          uniqueCardsCount,
          totalCardsCount,
          totalDatabaseCards: CARDS_DATABASE.length,
          deckIds
        }
      });
    }

    // ===== 2. POST /api/v1/gacha/claim-daily =====
    if (action === 'claim-daily' && req.method === 'POST') {
      const stats = await getOrCreateGachaStats(redis, userId);
      if (stats.lastDailyClaim === today) {
        return res.status(400).json({ error: 'Hadiah harian sudah diklaim hari ini' });
      }

      stats.coins = (stats.coins || 0) + GACHA_COSTS.DAILY_CLAIM_COINS;
      stats.lastDailyClaim = today;

      await redis.set(gachaStatsKey(userId), JSON.stringify(stats));

      return res.status(200).json({
        success: true,
        message: `Berhasil klaim +${GACHA_COSTS.DAILY_CLAIM_COINS} Gacha Coins harian!`,
        stats: {
          coins: stats.coins,
          tickets: stats.tickets,
          canClaimDaily: false
        }
      });
    }

    // ===== 3. POST /api/v1/gacha/pull =====
    if (action === 'pull' && req.method === 'POST') {
      const { pullType } = req.body || {}; // 'free' | 'single_coin' | 'single_ticket' | 'multi_coin' | 'multi_ticket'
      const stats = await getOrCreateGachaStats(redis, userId);

      let pullCount = 1;
      let costCoins = 0;
      let costTickets = 0;

      if (pullType === 'free') {
        if (stats.lastDailyFree === today) {
          return res.status(400).json({ error: 'Free Daily Pull sudah digunakan hari ini' });
        }
        stats.lastDailyFree = today;
      } else if (pullType === 'single_coin') {
        costCoins = GACHA_COSTS.SINGLE_COIN;
        if ((stats.coins || 0) < costCoins) {
          return res.status(400).json({ error: 'Gacha Coins tidak mencukupi (Butuh 100 Coins)' });
        }
      } else if (pullType === 'single_ticket') {
        costTickets = GACHA_COSTS.SINGLE_TICKET;
        if ((stats.tickets || 0) < costTickets) {
          return res.status(400).json({ error: 'Summon Ticket tidak mencukupi' });
        }
      } else if (pullType === 'multi_coin') {
        pullCount = 10;
        costCoins = GACHA_COSTS.MULTI_COIN;
        if ((stats.coins || 0) < costCoins) {
          return res.status(400).json({ error: 'Gacha Coins tidak mencukupi (Butuh 900 Coins)' });
        }
      } else if (pullType === 'multi_ticket') {
        pullCount = 10;
        costTickets = GACHA_COSTS.MULTI_TICKET;
        if ((stats.tickets || 0) < costTickets) {
          return res.status(400).json({ error: 'Summon Ticket tidak mencukupi (Butuh 10 Tiket)' });
        }
      } else {
        return res.status(400).json({ error: 'Jenis pull tidak valid' });
      }

      // Potong saldo
      stats.coins = Math.max(0, (stats.coins || 0) - costCoins);
      stats.tickets = Math.max(0, (stats.tickets || 0) - costTickets);

      // Eksekusi pull kartu
      const drawnItems = [];
      for (let i = 0; i < pullCount; i++) {
        // Pada multi-pull, slot terakhir (ke-10) dijamin minimal SR jika belum dapat SR+
        const isLastOfMulti = pullCount === 10 && i === pullCount - 1;
        const hasSrPlusSoFar = drawnItems.some((d) => ['SR', 'SSR', 'UR'].includes(d.rarity));
        const forceMinSr = isLastOfMulti && !hasSrPlusSoFar;

        const drawn = rollSingleCard(stats, forceMinSr);
        drawnItems.push(drawn);
      }

      // Simpan kartu ke inventory user
      const { results, userCards } = await addCardsToUser(redis, userId, drawnItems);

      // Simpan update stats
      await redis.set(gachaStatsKey(userId), JSON.stringify(stats));
      await bumpQuestProgress(redis, userId, 'gacha_pull', pullType === 'multi' ? 10 : 1);

      const uniqueCardsCount = Object.keys(userCards).length;
      const totalCardsCount = Object.values(userCards).reduce((acc, c) => acc + (c.count || 1), 0);

      return res.status(200).json({
        success: true,
        cards: results,
        stats: {
          coins: stats.coins,
          tickets: stats.tickets,
          totalPulls: stats.totalPulls,
          pitySr: stats.pitySr,
          pityUr: stats.pityUr,
          canFreePull: stats.lastDailyFree !== today,
          canClaimDaily: stats.lastDailyClaim !== today,
          uniqueCardsCount,
          totalCardsCount
        }
      });
    }

    // ===== 4. GET /api/v1/gacha/collection =====
    if (action === 'collection' && req.method === 'GET') {
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
      const rawDeck = await redis.get(userDeckKey(userId));
      const deckIds = rawDeck ? (typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck) : [];

      const collection = CARDS_DATABASE.map((card) => {
        const owned = userCards[card.id];
        return {
          ...card,
          isUnlocked: Boolean(owned),
          stars: owned?.stars || 1,
          count: owned?.count || 0,
          firstObtainedAt: owned?.firstObtainedAt || null,
          isInDeck: deckIds.includes(card.id)
        };
      });

      return res.status(200).json({
        success: true,
        collection,
        deckIds
      });
    }

    // ===== 5. POST /api/v1/gacha/deck =====
    if (action === 'deck' && req.method === 'POST') {
      const { cardIds } = req.body || {};
      if (!Array.isArray(cardIds) || cardIds.length > 3) {
        return res.status(400).json({ error: 'Maksimal 3 kartu dalam showcase deck' });
      }

      // Verifikasi kepemilikan kartu
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      for (const id of cardIds) {
        if (!userCards[id]) {
          return res.status(400).json({ error: 'Anda belum memiliki salah satu kartu yang dipilih' });
        }
      }

      await redis.set(userDeckKey(userId), JSON.stringify(cardIds));

      return res.status(200).json({
        success: true,
        message: 'Showcase Deck profil berhasil diperbarui!',
        deckIds: cardIds
      });
    }

    return res.status(404).json({ error: 'Aksi tidak ditemukan' });
  } catch (error) {
    console.error('Gacha handler error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server gacha' });
  }
}
