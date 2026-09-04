import { CARDS_DATABASE, getCardById } from '../../src/utils/cardsData.js';
import { gachaStatsKey, userDeckKey, userCardsKey, addCardsToUser } from './cards.js';

// Format tanggal WIB (UTC+7)
const nowWIB = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
};

const isoWeekStr = () => {
  const d = nowWIB();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const getTodayWib = () => nowWIB().toISOString().slice(0, 10);

const secondsUntilEndOfDayWIB = () => {
  const now = nowWIB();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
};

// Daftar Bos Dunia Mingguan
export const WORLD_BOSSES = [
  {
    id: 'boss_ignis',
    name: 'Infernal Colossus Ignis',
    title: 'Titan Neraka Api Abadi',
    element: 'Flame',
    weakness: ['Water', 'Void'],
    totalHp: 5000000,
    baseAtk: 3500,
    icon: 'Flame',
    color: '#ff4757',
    avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    desc: 'Makhluk kuno yang terbangun dari inti gunung berapi magma. Membakar seluruh medan tempur dengan lahar panas.'
  },
  {
    id: 'boss_raijin',
    name: 'Ancient Dragon Raijin',
    title: 'Naga Petir Guntur Langit',
    element: 'Light',
    weakness: ['Earth', 'Dark'],
    totalHp: 8000000,
    baseAtk: 4200,
    icon: 'Zap',
    color: '#38bdf8',
    avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    desc: 'Penguasa badai halilintar yang mampu memanggil petir pemusnah dari langit ketujuh.'
  },
  {
    id: 'boss_lucifer',
    name: 'Void Sovereign Lucifer',
    title: 'Dewa Kehancuran Dimensi Void',
    element: 'Void',
    weakness: ['Light'],
    totalHp: 12000000,
    baseAtk: 5500,
    icon: 'Crown',
    color: '#a855f7',
    avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    desc: 'Entitas purba penguasa kegelapan abadi yang menelan realitas ke dalam singularitas void.'
  }
];

export const RAID_MILESTONES = [
  { id: 'hp75', hpPercent: 75, label: '75% HP Bos Tersisa', coins: 600, tickets: 1 },
  { id: 'hp50', hpPercent: 50, label: '50% HP Bos Tersisa', coins: 1200, tickets: 2 },
  { id: 'hp25', hpPercent: 25, label: '25% HP Bos Tersisa', coins: 2000, tickets: 3 },
  { id: 'hp0', hpPercent: 0, label: 'BOS DIKALAHKAN (0% HP)', coins: 4000, tickets: 5, title: 'Titan Slayer' }
];

export const MAX_DAILY_ATTEMPTS = 3;

// Redis Keys
export const activeBossKey = () => 'raid:active_boss';
export const leaderboardKey = (week) => `raid:leaderboard:${week}`;
export const userDamageKey = (week, userId) => `raid:user_damage:${week}:${userId}`;
export const userAttemptsKey = (userId, today) => `raid:attempts:${userId}:${today}`;
export const milestoneClaimedKey = (week, userId) => `raid:milestone_claimed:${week}:${userId}`;
export const battleLogsKey = (week) => `raid:battle_logs:${week}`;

// Ambil info user
async function getUserBrief(redis, userId) {
  const raw = await redis.get(`user:${userId}`);
  if (!raw) return { id: userId, name: 'Petualang', picture: null, level: 1 };
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    id: userId,
    name: u.name || 'Petualang',
    picture: u.picture || null,
    level: u.level || 1
  };
}

// Inisialisasi atau Dapatkan Bos Aktif Minggu Ini
export async function getOrInitActiveBoss(redis) {
  const currentWeek = isoWeekStr();
  const raw = await redis.get(activeBossKey());
  let bossState = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;

  if (!bossState || bossState.seasonWeek !== currentWeek) {
    // Pilih bos sesuai rotasi minggu
    const weekNumInt = parseInt(currentWeek.split('-W')[1] || '1', 10);
    const bossTemplate = WORLD_BOSSES[(weekNumInt - 1) % WORLD_BOSSES.length];

    bossState = {
      ...bossTemplate,
      seasonWeek: currentWeek,
      currentHp: bossTemplate.totalHp,
      status: 'active', // 'active' | 'defeated'
      totalDamageDealt: 0,
      totalAttacks: 0,
      startedAt: nowWIB().toISOString(),
      defeatedAt: null
    };

    await redis.set(activeBossKey(), JSON.stringify(bossState));
  }

  return bossState;
}

// ===== 1. GET RAID STATUS =====
export async function getRaidStatus(redis, userId) {
  const boss = await getOrInitActiveBoss(redis);
  const week = boss.seasonWeek;
  const today = getTodayWib();

  const [attemptsRaw, userDamageRaw, claimedMilestonesRaw, recentLogsRaw, totalRaiders] = await Promise.all([
    userId ? redis.get(userAttemptsKey(userId, today)) : Promise.resolve(0),
    userId ? redis.get(userDamageKey(week, userId)) : Promise.resolve(null),
    userId ? redis.hgetall(milestoneClaimedKey(week, userId)) : Promise.resolve({}),
    redis.lrange(battleLogsKey(week), 0, 15),
    redis.zcard(leaderboardKey(week))
  ]);

  const attemptsUsed = parseInt(attemptsRaw || 0, 10) || 0;
  const remainingAttempts = Math.max(0, MAX_DAILY_ATTEMPTS - attemptsUsed);

  const userStats = userDamageRaw
    ? (typeof userDamageRaw === 'string' ? JSON.parse(userDamageRaw) : userDamageRaw)
    : { totalDamage: 0, attacksCount: 0 };

  let userRank = null;
  if (userId && userStats.totalDamage > 0) {
    const rank = await redis.zrevrank(leaderboardKey(week), userId);
    userRank = rank == null ? null : rank + 1;
  }

  const hpPercent = Math.max(0, Math.min(100, (boss.currentHp / boss.totalHp) * 100));

  // Milestone list dengan status klaim
  const milestones = RAID_MILESTONES.map((m) => {
    const isUnlocked = hpPercent <= m.hpPercent;
    const isClaimed = !!claimedMilestonesRaw?.[m.id];
    return {
      ...m,
      unlocked: isUnlocked,
      claimed: isClaimed,
      canClaim: isUnlocked && !isClaimed
    };
  });

  const recentLogs = (recentLogsRaw || []).map((l) => typeof l === 'string' ? JSON.parse(l) : l);

  return {
    success: true,
    boss: {
      ...boss,
      hpPercent: Math.round(hpPercent * 10) / 10
    },
    user: {
      remainingAttempts,
      maxAttempts: MAX_DAILY_ATTEMPTS,
      totalDamage: userStats.totalDamage || 0,
      attacksCount: userStats.attacksCount || 0,
      rank: userRank
    },
    milestones,
    recentLogs,
    totalRaiders: totalRaiders || 0
  };
}

// ===== 2. GET LEADERBOARD TOP RAIDERS =====
export async function getRaidLeaderboard(redis) {
  const boss = await getOrInitActiveBoss(redis);
  const week = boss.seasonWeek;

  const topUserIds = await redis.zrevrange(leaderboardKey(week), 0, 49, { withScores: true });
  const leaderboard = [];

  for (let i = 0; i < topUserIds.length; i += 2) {
    const uid = topUserIds[i];
    const score = parseInt(topUserIds[i + 1], 10) || 0;
    const userRaw = await redis.get(userDamageKey(week, uid));
    const userStats = userRaw ? (typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw) : {};

    leaderboard.push({
      rank: Math.floor(i / 2) + 1,
      userId: uid,
      userName: userStats.userName || 'Petualang',
      userAvatar: userStats.userAvatar || null,
      userLevel: userStats.userLevel || 1,
      totalDamage: score,
      attacksCount: userStats.attacksCount || 1
    });
  }

  return {
    success: true,
    seasonWeek: week,
    leaderboard
  };
}

// ===== 3. ATTACK WORLD BOSS =====
export async function attackWorldBoss(redis, userId) {
  const boss = await getOrInitActiveBoss(redis);
  if (boss.status === 'defeated' || boss.currentHp <= 0) {
    return { success: false, error: 'Bos Dunia minggu ini telah berhasil ditumbangkan!' };
  }

  const today = getTodayWib();
  const attemptsKey = userAttemptsKey(userId, today);
  const attemptsUsed = parseInt(await redis.get(attemptsKey) || 0, 10);

  if (attemptsUsed >= MAX_DAILY_ATTEMPTS) {
    return { success: false, error: 'Tiket serangan harianmu sudah habis! Coba lagi besok.' };
  }

  const [user, rawDeck, rawCards] = await Promise.all([
    getUserBrief(redis, userId),
    redis.get(userDeckKey(userId)),
    redis.get(userCardsKey(userId))
  ]);

  // Ambil deck kartu user
  let deck = [];
  if (rawDeck) {
    try {
      const parsed = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
      if (Array.isArray(parsed) && parsed.length > 0) deck = parsed;
    } catch {}
  }

  // Jika deck kosong, ambil 3 kartu terkuat dari inventory
  if (deck.length === 0 && rawCards) {
    try {
      const parsedCards = typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards;
      const allCards = Object.values(parsedCards).map((c) => ({
        ...getCardById(c.id),
        ...c
      })).filter(Boolean);
      allCards.sort((a, b) => (b.attack || 500) - (a.attack || 500));
      deck = allCards.slice(0, 4);
    } catch {}
  }

  // Kalkulasi Simulasi Pertarungan 5 Ronde Turn
  const battleRounds = [];
  let totalDamage = 0;
  const isWeakness = (el) => (boss.weakness || []).includes(el);

  // Jika tidak punya kartu sama sekali, fallback ke kekuatan level user
  if (deck.length === 0) {
    const baseDmg = (user.level || 1) * 800 + 5000;
    totalDamage = baseDmg;
    battleRounds.push({
      round: 1,
      attackerName: user.name,
      action: 'Serangan Mana Sihir Dasar',
      damage: baseDmg,
      crit: false,
      multiplier: 1.0
    });
  } else {
    for (let r = 1; r <= 5; r++) {
      const card = deck[(r - 1) % deck.length];
      let cardAtk = (card.attack || 600) * (1 + ((card.stars || 1) - 1) * 0.25);

      // Cek kelemahan elemen bos
      let multiplier = 1.0;
      let isElementAdvantage = false;
      if (isWeakness(card.element)) {
        multiplier = 1.5;
        isElementAdvantage = true;
      }

      // Critical Hit Chance (25%)
      const isCrit = Math.random() < 0.25;
      if (isCrit) multiplier *= 1.8;

      // Variasi damage (+- 10%)
      const variance = 0.9 + Math.random() * 0.2;
      const roundDmg = Math.round(cardAtk * 2.5 * multiplier * variance);

      totalDamage += roundDmg;

      battleRounds.push({
        round: r,
        cardName: card.name,
        cardRarity: card.rarity,
        cardElement: card.element,
        isElementAdvantage,
        damage: roundDmg,
        crit: isCrit,
        multiplier: Math.round(multiplier * 10) / 10
      });
    }
  }

  // Apply Damage ke HP Bos Global
  const newHp = Math.max(0, boss.currentHp - totalDamage);
  boss.currentHp = newHp;
  boss.totalDamageDealt = (boss.totalDamageDealt || 0) + totalDamage;
  boss.totalAttacks = (boss.totalAttacks || 0) + 1;

  if (newHp === 0 && boss.status !== 'defeated') {
    boss.status = 'defeated';
    boss.defeatedAt = nowWIB().toISOString();
  }

  // Update user damage di ZSET & Hash
  const week = boss.seasonWeek;
  const uDmgKey = userDamageKey(week, userId);
  const rawUDmg = await redis.get(uDmgKey);
  const uStats = rawUDmg ? (typeof rawUDmg === 'string' ? JSON.parse(rawUDmg) : rawUDmg) : { totalDamage: 0, attacksCount: 0 };

  const newUserTotal = (uStats.totalDamage || 0) + totalDamage;
  const newAttacksCount = (uStats.attacksCount || 0) + 1;

  const updatedUserStats = {
    userId,
    userName: user.name,
    userAvatar: user.picture,
    userLevel: user.level,
    totalDamage: newUserTotal,
    attacksCount: newAttacksCount,
    lastAttackTime: Date.now()
  };

  // Tambah Koin Partisipasi Serangan (150 Koin per attack)
  const gKey = gachaStatsKey(userId);
  const rawG = await redis.get(gKey);
  if (rawG) {
    const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    gStats.coins = (gStats.coins || 0) + 150;
    await redis.set(gKey, JSON.stringify(gStats));
  }

  // Catat Log Serangan
  const logEntry = {
    userId,
    userName: user.name,
    userAvatar: user.picture,
    damage: totalDamage,
    crit: battleRounds.some((r) => r.crit),
    time: Date.now()
  };

  await Promise.all([
    redis.set(activeBossKey(), JSON.stringify(boss)),
    redis.zadd(leaderboardKey(week), { score: newUserTotal, member: userId }),
    redis.set(uDmgKey, JSON.stringify(updatedUserStats)),
    redis.incr(attemptsKey),
    redis.lpush(battleLogsKey(week), JSON.stringify(logEntry)),
    redis.ltrim(battleLogsKey(week), 0, 30) // simpan 30 log terbaru
  ]);

  // Set TTL untuk attempts key sampai akhir hari
  await redis.expire(attemptsKey, secondsUntilEndOfDayWIB());

  const remainingAttempts = Math.max(0, MAX_DAILY_ATTEMPTS - (attemptsUsed + 1));
  const hpPercent = Math.max(0, Math.min(100, (boss.currentHp / boss.totalHp) * 100));

  return {
    success: true,
    damageDealt: totalDamage,
    battleRounds,
    bossCurrentHp: boss.currentHp,
    bossTotalHp: boss.totalHp,
    bossHpPercent: Math.round(hpPercent * 10) / 10,
    bossStatus: boss.status,
    remainingAttempts,
    rewardCoins: 150
  };
}

// ===== 4. KLAIM REWARD MILESTONE =====
export async function claimRaidMilestone(redis, userId, milestoneId) {
  const boss = await getOrInitActiveBoss(redis);
  const week = boss.seasonWeek;

  const milestone = RAID_MILESTONES.find((m) => m.id === milestoneId);
  if (!milestone) return { success: false, error: 'Milestone tidak valid' };

  const hpPercent = (boss.currentHp / boss.totalHp) * 100;
  if (hpPercent > milestone.hpPercent) {
    return { success: false, error: `Batas HP ${milestone.hpPercent}% belum tercapai` };
  }

  // Cek apakah user pernah berkontribusi minimal 1 serangan
  const uDmgKey = userDamageKey(week, userId);
  const rawUDmg = await redis.get(uDmgKey);
  if (!rawUDmg) {
    return { success: false, error: 'Kamu harus berpartisipasi minimal 1x serangan raid untuk mengklaim hadiah' };
  }

  const claimKey = milestoneClaimedKey(week, userId);
  const alreadyClaimed = await redis.hexists(claimKey, milestoneId);
  if (alreadyClaimed) {
    return { success: false, error: 'Hadiah milestone ini sudah kamu klaim' };
  }

  // Berikan Koin & Tiket ke gachaStats
  const gKey = gachaStatsKey(userId);
  const rawG = await redis.get(gKey);
  if (rawG) {
    const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    gStats.coins = (gStats.coins || 0) + milestone.coins;
    gStats.tickets = (gStats.tickets || 0) + milestone.tickets;
    await redis.set(gKey, JSON.stringify(gStats));
  }

  // Tandai sudah diklaim
  await redis.hset(claimKey, { [milestoneId]: '1' });
  await redis.expire(claimKey, 604800); // 7 hari

  return {
    success: true,
    milestone,
    reward: {
      coins: milestone.coins,
      tickets: milestone.tickets,
      title: milestone.title || null
    }
  };
}
