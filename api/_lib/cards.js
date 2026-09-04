import { CARDS_DATABASE, RARITY_CONFIG, getCardById } from '../../src/utils/cardsData.js';

export const GACHA_COSTS = {
  SINGLE_COIN: 100,
  MULTI_COIN: 900,
  SINGLE_TICKET: 1,
  MULTI_TICKET: 10,
  DAILY_CLAIM_COINS: 150,
  STARTER_COINS: 500,
  STARTER_TICKETS: 3
};

// Format tanggal WIB (UTC+7)
export const getTodayWibDate = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + 3600000 * 7);
  return wibTime.toISOString().slice(0, 10);
};

// Helper keys untuk Redis
export const gachaStatsKey = (userId) => `user:gacha_stats:${userId}`;
export const userCardsKey = (userId) => `user:cards:${userId}`;
export const userDeckKey = (userId) => `user:deck:${userId}`;

// Inisialisasi gacha stats untuk user baru
export const getOrCreateGachaStats = async (redis, userId) => {
  const key = gachaStatsKey(userId);
  const raw = await redis.get(key);
  let stats;

  if (!raw) {
    stats = {
      coins: GACHA_COSTS.STARTER_COINS,
      tickets: GACHA_COSTS.STARTER_TICKETS,
      totalPulls: 0,
      pitySr: 0,
      pityUr: 0,
      lastDailyFree: '',
      lastDailyClaim: '',
      createdAt: Date.now()
    };
    await redis.set(key, JSON.stringify(stats));
  } else {
    stats = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  return stats;
};

// Roll single card dengan kalkulasi pity & rates
export const rollSingleCard = (stats, forceMinSr = false) => {
  let pitySr = stats.pitySr || 0;
  let pityUr = stats.pityUr || 0;

  pitySr += 1;
  pityUr += 1;

  let selectedRarity = 'C';

  // Hard pity UR (pada pull ke-50)
  if (pityUr >= 50) {
    selectedRarity = 'UR';
  } else if (pitySr >= 10 || forceMinSr) {
    // Guaranteed SR atau lebih tinggi (pada pull ke-10 atau jaminan multi-pull)
    const roll = Math.random() * 100;
    if (roll < 5.0) { // 5% chance UR on guaranteed slot
      selectedRarity = 'UR';
    } else if (roll < 25.0) { // 20% chance SSR
      selectedRarity = 'SSR';
    } else { // 75% chance SR
      selectedRarity = 'SR';
    }
  } else {
    // Normal pull
    const roll = Math.random() * 100; // 0 - 100
    if (roll < RARITY_CONFIG.UR.rate) {
      selectedRarity = 'UR';
    } else if (roll < RARITY_CONFIG.UR.rate + RARITY_CONFIG.SSR.rate) {
      selectedRarity = 'SSR';
    } else if (roll < RARITY_CONFIG.UR.rate + RARITY_CONFIG.SSR.rate + RARITY_CONFIG.SR.rate) {
      selectedRarity = 'SR';
    } else if (roll < RARITY_CONFIG.UR.rate + RARITY_CONFIG.SSR.rate + RARITY_CONFIG.SR.rate + RARITY_CONFIG.R.rate) {
      selectedRarity = 'R';
    } else {
      selectedRarity = 'C';
    }
  }

  // Update pity counter
  if (selectedRarity === 'UR') {
    pityUr = 0;
    pitySr = 0;
  } else if (selectedRarity === 'SSR' || selectedRarity === 'SR') {
    pitySr = 0;
  }

  stats.pitySr = pitySr;
  stats.pityUr = pityUr;
  stats.totalPulls = (stats.totalPulls || 0) + 1;

  // Pilih kartu acak dari rarity yang didapat
  const pool = CARDS_DATABASE.filter((c) => c.rarity === selectedRarity);
  const card = pool[Math.floor(Math.random() * pool.length)];

  return {
    card,
    rarity: selectedRarity
  };
};

// Update user inventory kartu di Redis
export const addCardsToUser = async (redis, userId, drawnCards) => {
  const cardsKey = userCardsKey(userId);
  const rawCards = await redis.get(cardsKey);
  const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};

  const results = [];

  for (const item of drawnCards) {
    const { card } = item;
    const existing = userCards[card.id];
    let isNew = false;
    let stars = 1;
    let count = 1;

    if (!existing) {
      isNew = true;
      userCards[card.id] = {
        id: card.id,
        count: 1,
        stars: 1,
        firstObtainedAt: Date.now(),
        lastObtainedAt: Date.now()
      };
    } else {
      count = existing.count + 1;
      // Naik bintang setiap kelipatan duplikat (maksimal 5 bintang)
      stars = Math.min(5, Math.floor(1 + count / 2));
      userCards[card.id] = {
        ...existing,
        count,
        stars,
        lastObtainedAt: Date.now()
      };
    }

    results.push({
      ...card,
      isNew,
      stars,
      count
    });
  }

  await redis.set(cardsKey, JSON.stringify(userCards));
  return { userCards, results };
};
