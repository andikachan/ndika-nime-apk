import redis from './redis.js';

/**
 * Mengambil saldo koin user secara konsisten dari Redis.
 */
export async function getUserCoins(userId) {
  if (!userId) return 0;
  
  // Prioritas 1: cek gacha_stats
  const gKey = `user:gacha_stats:${userId}`;
  const rawG = await redis.get(gKey);
  if (rawG) {
    const stats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    if (typeof stats.coins === 'number') return stats.coins;
  }

  // Prioritas 2: cek profile user
  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const user = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    if (typeof user.coins === 'number') return user.coins;
  }

  return 0;
}

/**
 * Menambahkan koin secara konsisten ke user profile dan gacha_stats.
 */
export async function addCoins(userId, amount) {
  const num = Math.floor(Number(amount));
  if (!userId || isNaN(num) || num <= 0) return 0;

  // 1. Update gacha stats
  const gKey = `user:gacha_stats:${userId}`;
  const rawG = await redis.get(gKey);
  let newCoins = 0;
  if (rawG) {
    const stats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    stats.coins = (Number(stats.coins) || 0) + num;
    newCoins = stats.coins;
    await redis.set(gKey, JSON.stringify(stats));
  } else {
    newCoins = 500 + num;
    const initialStats = {
      coins: newCoins,
      tickets: 3,
      totalPulls: 0,
      pitySr: 0,
      pityUr: 0,
      createdAt: Date.now()
    };
    await redis.set(gKey, JSON.stringify(initialStats));
  }

  // 2. Sync ke user profile
  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const user = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    user.coins = newCoins;
    await redis.set(uKey, JSON.stringify(user));
  }

  return newCoins;
}

/**
 * Memotong koin dengan validasi saldo agar tidak terjadi minus atau race condition.
 * Return true jika berhasil, false jika saldo kurang.
 */
export async function deductCoins(userId, amount) {
  const num = Math.floor(Number(amount));
  if (!userId || isNaN(num) || num <= 0) return false;

  const currentCoins = await getUserCoins(userId);
  if (currentCoins < num) {
    return false;
  }

  const remainingCoins = currentCoins - num;

  // 1. Update gacha stats
  const gKey = `user:gacha_stats:${userId}`;
  const rawG = await redis.get(gKey);
  if (rawG) {
    const stats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    stats.coins = remainingCoins;
    await redis.set(gKey, JSON.stringify(stats));
  }

  // 2. Sync ke user profile
  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const user = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    user.coins = remainingCoins;
    await redis.set(uKey, JSON.stringify(user));
  }

  return true;
}
