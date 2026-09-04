import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { CARDS_DATABASE, getCardById } from '../../src/utils/cardsData.js';
import {
  PVE_TOWER_FLOORS,
  ARENA_RANKS,
  getArenaRank,
  simulateCardBattle
} from '../../src/utils/arenaData.js';
import { gachaStatsKey, userCardsKey } from '../_lib/cards.js';
import { bumpQuestProgress } from '../_lib/quests.js';

// redis singleton from _lib/redis.js

const userArenaKey = (userId) => `user:arena:${userId}`;
const ARENA_LEADERBOARD_KEY = 'arena:global_leaderboard';

// verifyUserId imported from _lib/auth.js

// Hitung regenerasi energi arena (1 energi setiap 20 menit, maks 10)
const computeCurrentEnergy = (arenaData) => {
  const MAX_ENERGY = 10;
  const REGEN_MS = 20 * 60 * 1000; // 20 Menit

  let curEnergy = arenaData.energy !== undefined ? arenaData.energy : MAX_ENERGY;
  let lastUpdate = arenaData.lastEnergyUpdate || Date.now();

  if (curEnergy < MAX_ENERGY) {
    const now = Date.now();
    const elapsed = now - lastUpdate;
    const restored = Math.floor(elapsed / REGEN_MS);

    if (restored > 0) {
      curEnergy = Math.min(MAX_ENERGY, curEnergy + restored);
      lastUpdate = now - (elapsed % REGEN_MS);
    }
  } else {
    lastUpdate = Date.now();
  }

  return { energy: curEnergy, lastEnergyUpdate: lastUpdate };
};

const getOrCreateArenaData = async (userId) => {
  const key = userArenaKey(userId);
  const raw = await redis.get(key);
  let data;

  if (!raw) {
    // Ambil kartu pertama yang dimiliki sebagai default deck
    const rawCards = await redis.get(userCardsKey(userId));
    const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
    const ownedIds = Object.keys(userCards);

    const defaultDeck = ownedIds.length >= 3 
      ? ownedIds.slice(0, 3) 
      : ['gojo_void', 'luffy_gear5', 'tanjiro_sun'];

    data = {
      deck: defaultDeck,
      rp: 1000,
      wins: 0,
      losses: 0,
      pveFloor: 1,
      energy: 10,
      lastEnergyUpdate: Date.now(),
      createdAt: Date.now()
    };
    await redis.set(key, JSON.stringify(data));
    await redis.zadd(ARENA_LEADERBOARD_KEY, { score: 1000, member: userId });
  } else {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  const { energy, lastEnergyUpdate } = computeCurrentEnergy(data);
  data.energy = energy;
  data.lastEnergyUpdate = lastEnergyUpdate;

  return data;
};

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== 1. GET /api/v1/arena/leaderboard (PUBLIC) =====
  if (action === 'leaderboard' && req.method === 'GET') {
    try {
      const topMembers = await redis.zrange(ARENA_LEADERBOARD_KEY, 0, 49, { rev: true, withScores: true });
      const leaderboard = [];

      for (let i = 0; i < topMembers.length; i += 2) {
        const targetId = topMembers[i];
        const score = topMembers[i + 1];
        if (!targetId) continue;

        const targetUserRaw = await redis.get(`user:${targetId}`);
        const targetUserData = targetUserRaw ? (typeof targetUserRaw === 'string' ? JSON.parse(targetUserRaw) : targetUserRaw) : null;
        const targetArenaRaw = await redis.get(userArenaKey(targetId));
        const targetArenaData = targetArenaRaw ? (typeof targetArenaRaw === 'string' ? JSON.parse(targetArenaRaw) : targetArenaRaw) : null;

        leaderboard.push({
          rank: Math.floor(i / 2) + 1,
          userId: targetId,
          name: targetUserData?.name || 'Anime Warrior',
          picture: targetUserData?.picture || null,
          title: targetUserData?.customTitle || targetUserData?.title || 'Anime Fighter',
          aura: targetUserData?.aura || 'none',
          frame: targetUserData?.frame || 'none',
          rp: Number(score) || 1000,
          rankTier: getArenaRank(Number(score) || 1000),
          wins: targetArenaData?.wins || 0,
          losses: targetArenaData?.losses || 0,
          pveFloor: targetArenaData?.pveFloor || 1
        });
      }

      return res.status(200).json({ success: true, leaderboard });
    } catch (e) {
      console.error('Arena leaderboard error:', e);
      return res.status(500).json({ error: 'Gagal memuat leaderboard arena' });
    }
  }

  // Semua aksi berikutnya membutuhkan autentikasi login
  const userId = verifyUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Harap login terlebih dahulu' });
  }

  try {
    // ===== 2. GET /api/v1/arena/status =====
    if (action === 'status' && req.method === 'GET') {
      const arena = await getOrCreateArenaData(userId);
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      const deckCards = (arena.deck || [])
        .map((id) => {
          const base = getCardById(id);
          if (!base) return null;
          const userMeta = userCards[id] || { stars: 1 };
          return {
            ...base,
            stars: userMeta.stars || 1
          };
        })
        .filter(Boolean);

      // Hitung sisa detik hingga energi berikutnya pulih (+1 per 20 menit)
      const REGEN_MS = 20 * 60 * 1000;
      let nextEnergyInSeconds = 0;
      if ((arena.energy || 0) < 10) {
        const elapsed = Date.now() - (arena.lastEnergyUpdate || Date.now());
        nextEnergyInSeconds = Math.max(0, Math.ceil((REGEN_MS - (elapsed % REGEN_MS)) / 1000));
      }

      const rankTier = getArenaRank(arena.rp);
      const currentPveFloor = PVE_TOWER_FLOORS[Math.min(49, (arena.pveFloor || 1) - 1)];

      return res.status(200).json({
        success: true,
        arena: {
          ...arena,
          pveFloor: arena.pveFloor || 1,
          energy: arena.energy,
          rankTier,
          deckCards,
          deckIds: arena.deck || [],
          nextEnergyInSeconds
        },
        currentPveFloor
      });
    }

    // ===== 3. POST /api/v1/arena/deck =====
    if (action === 'deck' && req.method === 'POST') {
      const { cardIds } = req.body || {};
      if (!Array.isArray(cardIds) || cardIds.length !== 3) {
        return res.status(400).json({ error: 'Deck pertempuran harus terdiri dari 3 kartu' });
      }

      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      for (const id of cardIds) {
        if (!userCards[id]) {
          return res.status(400).json({ error: 'Anda belum memiliki salah satu kartu dalam deck yang dipilih' });
        }
      }

      const arena = await getOrCreateArenaData(userId);
      arena.deck = cardIds;
      await redis.set(userArenaKey(userId), JSON.stringify(arena));

      return res.status(200).json({
        success: true,
        message: 'Deck Pertempuran Arena berhasil disimpan!',
        deckIds: cardIds
      });
    }

    // ===== 4. POST /api/v1/arena/pve-battle =====
    if (action === 'pve-battle' && req.method === 'POST') {
      const arena = await getOrCreateArenaData(userId);

      if (arena.energy < 1) {
        return res.status(400).json({ error: 'Energi habis! Tunggu regenerasi atau beli energi' });
      }

      const floorNum = Math.min(50, Math.max(1, req.body?.floor || arena.pveFloor || 1));
      const floorBoss = PVE_TOWER_FLOORS[floorNum - 1];

      // Ambil kartu pemain
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      const playerDeckCards = (arena.deck || [])
        .map((id) => {
          const base = getCardById(id);
          if (!base) return null;
          const userMeta = userCards[id] || { stars: 1 };
          return { ...base, stars: userMeta.stars || 1 };
        })
        .filter(Boolean);

      if (playerDeckCards.length < 3) {
        return res.status(400).json({ error: 'Atur 3 kartu pertempuran terlebih dahulu di Deck Builder' });
      }

      // Format Boss sebagai kartu lawan
      const bossCard = {
        id: `boss_${floorNum}`,
        name: floorBoss.name,
        subtitle: floorBoss.title,
        anime: floorBoss.anime,
        rarity: floorNum % 10 === 0 ? 'UR' : floorNum % 5 === 0 ? 'SSR' : 'SR',
        element: floorBoss.element,
        atk: floorBoss.atk,
        def: floorBoss.def,
        hp: floorBoss.hp,
        skill: floorBoss.skill,
        quote: floorBoss.quote,
        stars: Math.min(5, Math.ceil(floorNum / 10))
      };

      // Jalankan Simulasi Auto-Battle
      const battleResult = simulateCardBattle(playerDeckCards, [bossCard], true);

      // Kurangi 1 energi
      arena.energy = Math.max(0, arena.energy - 1);

      let rewardsGiven = null;

      if (battleResult.victory) {
        // Jika menang di lantai tertinggi pemain, naikkan lantai
        if (floorNum >= (arena.pveFloor || 1)) {
          arena.pveFloor = Math.min(50, floorNum + 1);
        }

        // Berikan hadiah
        const gStatsKey = gachaStatsKey(userId);
        const rawGStats = await redis.get(gStatsKey);
        const gStats = rawGStats ? (typeof rawGStats === 'string' ? JSON.parse(rawGStats) : rawGStats) : { coins: 0, tickets: 0 };

        gStats.coins = (gStats.coins || 0) + floorBoss.rewards.coins;
        gStats.tickets = (gStats.tickets || 0) + floorBoss.rewards.tickets;
        await redis.set(gStatsKey, JSON.stringify(gStats));

        // Tambah User EXP
        const uKey = `user:${userId}`;
        const rawUser = await redis.get(uKey);
        if (rawUser) {
          const uData = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
          uData.exp = (uData.exp || 0) + floorBoss.rewards.exp;
          await redis.set(uKey, JSON.stringify(uData));
        }

        rewardsGiven = floorBoss.rewards;
      }

      await redis.set(userArenaKey(userId), JSON.stringify(arena));
      await bumpQuestProgress(redis, userId, 'arena_battle', 1);

      return res.status(200).json({
        success: true,
        victory: battleResult.victory,
        battleResult,
        rewards: rewardsGiven,
        newFloor: arena.pveFloor,
        energy: arena.energy
      });
    }

    // ===== 5. GET /api/v1/arena/pvp-opponents =====
    if (action === 'pvp-opponents' && req.method === 'GET') {
      const arena = await getOrCreateArenaData(userId);
      const userRp = arena.rp || 1000;

      let memberIds = [];
      try {
        const minScore = Math.max(0, userRp - 400);
        const maxScore = userRp + 400;
        const rawRange = await redis.zrange(ARENA_LEADERBOARD_KEY, minScore, maxScore, { byScore: true });
        if (Array.isArray(rawRange)) {
          memberIds = rawRange.filter((id) => id !== userId);
        }
      } catch (e) {
        console.error('zrange pvp opponents error:', e);
      }

      const opponents = [];
      for (const opId of memberIds.slice(0, 4)) {
        try {
          const opUserRaw = await redis.get(`user:${opId}`);
          const opUserData = opUserRaw ? (typeof opUserRaw === 'string' ? JSON.parse(opUserRaw) : opUserRaw) : null;
          const opArenaRaw = await redis.get(userArenaKey(opId));
          const opArenaData = opArenaRaw ? (typeof opArenaRaw === 'string' ? JSON.parse(opArenaRaw) : opArenaRaw) : null;

          if (opUserData && opArenaData) {
            const rawCards = await redis.get(userCardsKey(opId));
            const opCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
            const deck = (opArenaData.deck || []).map((id) => {
              const base = getCardById(id);
              if (!base) return null;
              return { ...base, stars: opCards[id]?.stars || 1 };
            }).filter(Boolean);

            opponents.push({
              userId: opId,
              name: opUserData.name || 'Rival Duelist',
              picture: opUserData.picture || null,
              title: opUserData.customTitle || opUserData.title || 'Anime Fighter',
              aura: opUserData.aura || 'none',
              frame: opUserData.frame || 'none',
              rp: opArenaData.rp || 1000,
              rankTier: getArenaRank(opArenaData.rp || 1000),
              deck
            });
          }
        } catch (err) {
          console.error('Error fetching single opponent:', opId, err);
        }
      }

      // Dynamic Challenger Pool yang terskala sesuai RP pemain
      if (opponents.length < 4) {
        const botDeckTiers = [
          {
            name: 'Shadow Monarch Sung',
            title: 'Ranked Challenger (Shadow)',
            aura: 'celestial_godly',
            deckIds: ['sung_jinwoo', 'gojo_void', 'sukuna_curse'],
            rpOffset: 75,
            stars: userRp > 2500 ? 3 : userRp > 1500 ? 2 : 1
          },
          {
            name: 'Liberation God Nika',
            title: 'Sun Warrior (Light)',
            aura: 'super_saiyan',
            deckIds: ['luffy_gear5', 'tanjiro_sun', 'zoro_kingofhell'],
            rpOffset: 25,
            stars: userRp > 2500 ? 3 : userRp > 1500 ? 2 : 1
          },
          {
            name: 'Fullmetal Alchemist Team',
            title: 'Alchemic Master (Earth & Flame)',
            aura: 'cursed_flame',
            deckIds: ['edward_elric', 'roy_mustang', 'eren_founding'],
            rpOffset: -40,
            stars: userRp > 2000 ? 2 : 1
          },
          {
            name: 'Funeral Sorcery Squad',
            title: 'Arcane Dominance',
            aura: 'shadow_neon',
            deckIds: ['frieren_magic', 'fern_frieren', 'stark_frieren'],
            rpOffset: 110,
            stars: userRp > 3000 ? 4 : userRp > 1800 ? 3 : 2
          }
        ];

        botDeckTiers.forEach((bot, idx) => {
          if (opponents.length < 4) {
            const botRp = Math.max(500, userRp + bot.rpOffset);
            const deck = bot.deckIds
              .map(getCardById)
              .filter(Boolean)
              .map((c) => ({ ...c, stars: bot.stars }));

            opponents.push({
              userId: `bot_challenger_${idx}_${Math.floor(userRp / 100)}`,
              name: bot.name,
              title: bot.title,
              aura: bot.aura,
              rp: botRp,
              rankTier: getArenaRank(botRp),
              deck,
              isBot: true
            });
          }
        });
      }

      return res.status(200).json({ success: true, opponents });
    }

    // ===== 6. POST /api/v1/arena/pvp-battle =====
    if (action === 'pvp-battle' && req.method === 'POST') {
      const arena = await getOrCreateArenaData(userId);

      if (arena.energy < 1) {
        return res.status(400).json({ error: 'Energi pertempuran habis! Tunggu regenerasi otomatis (+1 per 20 menit)' });
      }

      const { targetUserId, isBot, botDeck } = req.body || {};
      if (!targetUserId) {
        return res.status(400).json({ error: 'Target lawan duel tidak valid' });
      }

      // Ambil Kartu Pemain
      const rawCards = await redis.get(userCardsKey(userId));
      const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

      const playerDeckCards = (arena.deck || [])
        .map((id) => {
          const base = getCardById(id);
          if (!base) return null;
          const userMeta = userCards[id] || { stars: 1 };
          return { ...base, stars: userMeta.stars || 1 };
        })
        .filter(Boolean);

      if (playerDeckCards.length < 3) {
        return res.status(400).json({ error: 'Atur 3 kartu di Deck Builder terlebih dahulu' });
      }

      // Ambil Kartu Lawan
      let opponentDeckCards = [];
      if (isBot && Array.isArray(botDeck) && botDeck.length > 0) {
        opponentDeckCards = botDeck;
      } else {
        const opArenaRaw = await redis.get(userArenaKey(targetUserId));
        const opArenaData = opArenaRaw ? (typeof opArenaRaw === 'string' ? JSON.parse(opArenaRaw) : opArenaRaw) : null;
        const opCardsRaw = await redis.get(userCardsKey(targetUserId));
        const opCards = opCardsRaw ? (typeof opCardsRaw === 'string' ? JSON.parse(opCardsRaw) : opCardsRaw) : {};

        opponentDeckCards = (opArenaData?.deck || ['gojo_void', 'luffy_gear5', 'tanjiro_sun'])
          .map((id) => {
            const base = getCardById(id);
            if (!base) return null;
            return { ...base, stars: opCards[id]?.stars || 1 };
          })
          .filter(Boolean);
      }

      // Jalankan Auto-Battle
      const battleResult = simulateCardBattle(playerDeckCards, opponentDeckCards, false);

      arena.energy = Math.max(0, arena.energy - 1);

      let rpChange = 0;
      let rewards = null;

      if (battleResult.victory) {
        rpChange = Math.floor(22 + Math.random() * 6); // +22-27 RP
        arena.rp = (arena.rp || 1000) + rpChange;
        arena.wins = (arena.wins || 0) + 1;

        // Hadiah Kemenangan PVP Terukur (Mencegah Infinite Inflation)
        rewards = { coins: 60, exp: 40 };

        const gStatsKey = gachaStatsKey(userId);
        const rawGStats = await redis.get(gStatsKey);
        const gStats = rawGStats ? (typeof rawGStats === 'string' ? JSON.parse(rawGStats) : rawGStats) : { coins: 0 };
        gStats.coins = (gStats.coins || 0) + rewards.coins;
        await redis.set(gStatsKey, JSON.stringify(gStats));
      } else {
        rpChange = -Math.floor(12 + Math.random() * 6); // -12-17 RP
        arena.rp = Math.max(0, (arena.rp || 1000) + rpChange);
        arena.losses = (arena.losses || 0) + 1;
      }

      await redis.set(userArenaKey(userId), JSON.stringify(arena));
      await redis.zadd(ARENA_LEADERBOARD_KEY, { score: arena.rp, member: userId });
      await bumpQuestProgress(redis, userId, 'arena_battle', 1);

      return res.status(200).json({
        success: true,
        victory: battleResult.victory,
        battleResult,
        rpChange,
        newRp: arena.rp,
        rankTier: getArenaRank(arena.rp),
        rewards,
        energy: arena.energy
      });
    }

    return res.status(404).json({ error: 'Aksi arena tidak ditemukan' });
  } catch (err) {
    console.error('Arena API error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server arena' });
  }
}
