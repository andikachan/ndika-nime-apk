import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  getTodayDailyQuests,
  WEEKLY_QUESTS,
  getAllQuests,
  progressKey,
  claimedKey,
  contributeBoss,
  DAILY_CHESTS,
  chestClaimedKey,
  secondsUntilEndOfDay
} from '../_lib/quests.js';
import {
  applyClassBonus, rollItemDrop, addItem, getInventory, consumeItem,
  activateXpBoost, consumeXpBoostIfActive, getItem, getBossStatus, claimBossReward,
  SKILLS, getAvailableSkillPoints, getXpBonusPct, getDropBonusPct, unlockSkill,
  getStoryArcsStatus, claimStoryStage, getGuildLeaderboard, getBossHallOfFame
} from '../_lib/rpg.js';
import { getOrCreateGachaStats, gachaStatsKey } from '../_lib/cards.js';

// Satu file untuk semua aksi quest, mengikuti pola file [...action].js lain
// (trivia, comments, reactions) supaya konsisten dan gampang dirawat.
// redis singleton from _lib/redis.js

// verifyUserId imported from _lib/auth.js

const publicQuest = (q) => ({
  id: q.id,
  period: q.period,
  title: q.title,
  desc: q.desc,
  icon: q.icon,
  target: q.target,
  reward: q.reward,
  coins: q.coins || 30,
  tier: q.tier || null,
  tierLabel: q.tierLabel || null,
  rank: q.rank || 'Rank D'
});

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (action === 'today') {
    // ===== GET /api/v1/quests/today =====
    // Balikin katalog quest harian + mingguan lengkap dengan progress, rank, & milestone chests.
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);

      const buildList = async (list) => {
        return Promise.all(
          list.map(async (q) => {
            let progress = 0;
            let claimed = false;
            if (userId) {
              const rawProgress = await redis.get(progressKey(userId, q));
              progress = rawProgress ? parseInt(rawProgress, 10) || 0 : 0;
              const rawClaimed = await redis.get(claimedKey(userId, q));
              claimed = !!rawClaimed;
            }
            const capped = Math.min(progress, q.target);
            return {
              ...publicQuest(q),
              progress: capped,
              completed: capped >= q.target,
              claimed
            };
          })
        );
      };

      const daily = await buildList(getTodayDailyQuests());
      const weekly = await buildList(WEEKLY_QUESTS);

      // Hitung total quest harian yang sudah selesai
      const completedDailyCount = daily.filter((q) => q.completed).length;
      const claimedDailyCount = daily.filter((q) => q.claimed).length;
      const unclaimedCount = daily.filter((q) => q.completed && !q.claimed).length + weekly.filter((q) => q.completed && !q.claimed).length;

      // Status Milestone Peti Harian
      const chests = await Promise.all(
        DAILY_CHESTS.map(async (chest) => {
          let claimed = false;
          if (userId) {
            const raw = await redis.get(chestClaimedKey(userId, chest.id));
            claimed = !!raw;
          }
          return {
            ...chest,
            progress: Math.min(completedDailyCount, chest.target),
            completed: completedDailyCount >= chest.target,
            claimed
          };
        })
      );

      return res.json({
        success: true,
        loggedIn: !!userId,
        daily,
        weekly,
        chests,
        completedDailyCount,
        claimedDailyCount,
        unclaimedCount
      });
    } catch (error) {
      console.error('❌ Quests today error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'claim') {
    // ===== POST /api/v1/quests/claim { questId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu untuk klaim quest' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const questId = body?.questId;
      const quest = getAllQuests().find((q) => q.id === questId);
      if (!quest) {
        return res.status(404).json({ error: 'Quest tidak ditemukan' });
      }

      const cKey = claimedKey(userId, quest);
      const alreadyClaimed = await redis.get(cKey);
      if (alreadyClaimed) {
        return res.status(409).json({ success: false, error: 'Quest ini sudah diklaim' });
      }

      const rawProgress = await redis.get(progressKey(userId, quest));
      const progress = rawProgress ? parseInt(rawProgress, 10) || 0 : 0;
      if (progress < quest.target) {
        return res.status(400).json({ success: false, error: 'Quest belum selesai' });
      }

      // Tandai sudah diklaim, TTL ikut TTL counter progress-nya (auto-hilang pas periode reset)
      const progTtl = await redis.ttl(progressKey(userId, quest));
      await redis.set(cKey, '1', progTtl > 0 ? { ex: progTtl } : undefined);

      // ===== Hitung reward final: bonus Class -> bonus Skill Tree -> boost 2x (kalau aktif) =====
      const userKeyStr = `user:${userId}`;
      const userDataRaw = await redis.get(userKeyStr);
      const user = userDataRaw ? (typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw) : null;
      let finalReward = applyClassBonus(quest.reward, user?.classId, quest.metric);
      finalReward = Math.floor(finalReward * (1 + getXpBonusPct(user) / 100));
      const boostUsed = await consumeXpBoostIfActive(redis, userId);
      if (boostUsed) finalReward *= 2;

      // ===== Reward Koin =====
      const questCoins = quest.coins || 30;
      const gStats = await getOrCreateGachaStats(redis, userId);
      gStats.coins = (gStats.coins || 0) + questCoins;
      await redis.set(gachaStatsKey(userId), JSON.stringify(gStats));

      // ===== Kemungkinan drop item RPG (dipengaruhi skill Hoki) =====
      const droppedItemId = rollItemDrop(getDropBonusPct(user));
      if (droppedItemId) {
        await addItem(redis, userId, droppedItemId, 1);
      }

      // ===== Terapkan reward XP ke watchTime/level user, lalu update leaderboard =====
      let newWatchTime = null;
      let newLevel = null;
      if (user) {
        newWatchTime = (user.watchTime || 0) + finalReward;
        newLevel = Math.floor(newWatchTime / 600);
        user.watchTime = newWatchTime;
        user.level = newLevel;
        user.coins = (user.coins || 0) + questCoins;
        user.lastWatchUpdate = new Date().toISOString();
        await redis.set(userKeyStr, JSON.stringify(user));
        await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
      }

      return res.json({
        success: true,
        quest: publicQuest(quest),
        reward: finalReward,
        coins: questCoins,
        boostUsed,
        droppedItem: droppedItemId ? getItem(droppedItemId) : null,
        newWatchTime,
        newLevel
      });
    } catch (error) {
      console.error('❌ Quest claim error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'claim-all') {
    // ===== POST /api/v1/quests/claim-all =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }

      const allQuests = getAllQuests();
      let totalXp = 0;
      let totalCoins = 0;
      let claimedQuests = [];
      let droppedItems = [];

      const userKeyStr = `user:${userId}`;
      const userDataRaw = await redis.get(userKeyStr);
      const user = userDataRaw ? (typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw) : null;
      const gStats = await getOrCreateGachaStats(redis, userId);

      for (const quest of allQuests) {
        const cKey = claimedKey(userId, quest);
        const alreadyClaimed = await redis.get(cKey);
        if (alreadyClaimed) continue;

        const rawProgress = await redis.get(progressKey(userId, quest));
        const progress = rawProgress ? parseInt(rawProgress, 10) || 0 : 0;
        if (progress < quest.target) continue;

        const progTtl = await redis.ttl(progressKey(userId, quest));
        await redis.set(cKey, '1', progTtl > 0 ? { ex: progTtl } : undefined);

        let qReward = applyClassBonus(quest.reward, user?.classId, quest.metric);
        qReward = Math.floor(qReward * (1 + getXpBonusPct(user) / 100));
        const qCoins = quest.coins || 30;

        totalXp += qReward;
        totalCoins += qCoins;
        claimedQuests.push(publicQuest(quest));

        const droppedItemId = rollItemDrop(getDropBonusPct(user));
        if (droppedItemId) {
          await addItem(redis, userId, droppedItemId, 1);
          droppedItems.push(getItem(droppedItemId));
        }
      }

      if (claimedQuests.length === 0) {
        return res.json({ success: false, error: 'Tidak ada quest yang bisa diklaim saat ini' });
      }

      // Update coins & user XP
      gStats.coins = (gStats.coins || 0) + totalCoins;
      await redis.set(gachaStatsKey(userId), JSON.stringify(gStats));

      let newWatchTime = null;
      let newLevel = null;
      if (user) {
        newWatchTime = (user.watchTime || 0) + totalXp;
        newLevel = Math.floor(newWatchTime / 600);
        user.watchTime = newWatchTime;
        user.level = newLevel;
        user.coins = (user.coins || 0) + totalCoins;
        user.lastWatchUpdate = new Date().toISOString();
        await redis.set(userKeyStr, JSON.stringify(user));
        await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
      }

      return res.json({
        success: true,
        claimedCount: claimedQuests.length,
        claimedQuests,
        totalXp,
        totalCoins,
        droppedItems,
        newWatchTime,
        newLevel
      });
    } catch (error) {
      console.error('❌ Claim all error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'claim-chest') {
    // ===== POST /api/v1/quests/claim-chest { chestId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const chestId = body?.chestId;
      const chest = DAILY_CHESTS.find((c) => c.id === chestId);
      if (!chest) {
        return res.status(404).json({ error: 'Peti tidak ditemukan' });
      }

      const cKey = chestClaimedKey(userId, chest.id);
      const alreadyClaimed = await redis.get(cKey);
      if (alreadyClaimed) {
        return res.status(409).json({ error: 'Peti ini sudah diklaim hari ini' });
      }

      // Verifikasi jumlah quest harian yang selesai
      const dailyQuests = getTodayDailyQuests();
      let completedDaily = 0;
      for (const q of dailyQuests) {
        const rawProgress = await redis.get(progressKey(userId, q));
        const progress = rawProgress ? parseInt(rawProgress, 10) || 0 : 0;
        if (progress >= q.target) completedDaily++;
      }

      if (completedDaily < chest.target) {
        return res.status(400).json({ error: `Selesaikan minimal ${chest.target} Quest Harian untuk membuka peti ini` });
      }

      // Tandai sudah klaim dengan TTL akhir hari WIB
      await redis.set(cKey, '1', { ex: secondsUntilEndOfDay() });

      // Reward Koin & Tiket Gacha
      const gStats = await getOrCreateGachaStats(redis, userId);
      gStats.coins = (gStats.coins || 0) + chest.coins;
      gStats.tickets = (gStats.tickets || 0) + (chest.tickets || 0);
      await redis.set(gachaStatsKey(userId), JSON.stringify(gStats));

      // Reward XP & RPG Drop
      const userKeyStr = `user:${userId}`;
      const userDataRaw = await redis.get(userKeyStr);
      const user = userDataRaw ? (typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw) : null;
      let newWatchTime = null;
      let newLevel = null;

      if (user) {
        newWatchTime = (user.watchTime || 0) + chest.xp;
        newLevel = Math.floor(newWatchTime / 600);
        user.watchTime = newWatchTime;
        user.level = newLevel;
        user.coins = (user.coins || 0) + chest.coins;
        user.lastWatchUpdate = new Date().toISOString();
        await redis.set(userKeyStr, JSON.stringify(user));
        await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
      }

      const droppedItemId = rollItemDrop(50); // 50% chance drop item dari peti
      if (droppedItemId) {
        await addItem(redis, userId, droppedItemId, 1);
      }

      return res.json({
        success: true,
        chest,
        coins: chest.coins,
        tickets: chest.tickets || 0,
        xp: chest.xp,
        droppedItem: droppedItemId ? getItem(droppedItemId) : null,
        newWatchTime,
        newLevel
      });
    } catch (error) {
      console.error('❌ Claim chest error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'inventory') {
    // ===== GET /api/v1/quests/inventory =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.json({ success: true, loggedIn: false, items: [] });
      }
      const items = await getInventory(redis, userId);
      return res.json({ success: true, loggedIn: true, items });
    } catch (error) {
      console.error('❌ Quest inventory error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'use-item') {
    // ===== POST /api/v1/quests/use-item { itemId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const itemId = body?.itemId;
      const item = getItem(itemId);
      if (!item) {
        return res.status(404).json({ error: 'Item tidak ditemukan' });
      }

      const consumed = await consumeItem(redis, userId, itemId);
      if (!consumed) {
        return res.status(400).json({ error: 'Item ini tidak ada di inventorymu' });
      }

      if (itemId === 'scroll_2x') {
        await activateXpBoost(redis, userId);
        return res.json({ success: true, effect: 'boost_2x_active', message: 'XP quest berikutnya yang kamu klaim bakal 2x lipat (berlaku 1 jam)!' });
      }

      if (itemId === 'crest_boss') {
        await contributeBoss(redis, userId, 3);
        const status = await getBossStatus(redis, userId);
        return res.json({ success: true, effect: 'boss_damage', boss: status, message: '+3 poin damage disumbangkan ke Boss Mingguan!' });
      }

      return res.json({ success: true, effect: 'none' });
    } catch (error) {
      console.error('❌ Quest use-item error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'boss') {
    // ===== GET /api/v1/quests/boss =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      const status = await getBossStatus(redis, userId);
      return res.json({ success: true, loggedIn: !!userId, boss: status });
    } catch (error) {
      console.error('❌ Boss status error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'boss-claim') {
    // ===== POST /api/v1/quests/boss-claim =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }
      const result = await claimBossReward(redis, userId);
      if (!result.success) {
        return res.status(400).json({ success: false, error: 'Belum bisa klaim (boss belum kalah / kamu belum kontribusi / sudah diklaim)', boss: result.status });
      }
      return res.json({ success: true, boss: result.status, reward: result.status.reward, newWatchTime: result.newWatchTime, newLevel: result.newLevel });
    } catch (error) {
      console.error('❌ Boss claim error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'skills') {
    // ===== GET /api/v1/quests/skills =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.json({ success: true, loggedIn: false, skills: SKILLS, unlocked: [], availablePoints: 0, level: 0 });
      }
      const userData = await redis.get(`user:${userId}`);
      const user = userData ? (typeof userData === 'string' ? JSON.parse(userData) : userData) : null;
      return res.json({
        success: true,
        loggedIn: true,
        skills: SKILLS,
        unlocked: user?.skills || [],
        availablePoints: getAvailableSkillPoints(user),
        level: user?.level || 0
      });
    } catch (error) {
      console.error('❌ Skills list error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'skill-unlock') {
    // ===== POST /api/v1/quests/skill-unlock { skillId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const result = await unlockSkill(redis, userId, body?.skillId);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, skills: result.skills });
    } catch (error) {
      console.error('❌ Skill unlock error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'story') {
    // ===== GET /api/v1/quests/story =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      const arcs = await getStoryArcsStatus(redis, userId);
      return res.json({ success: true, loggedIn: !!userId, arcs });
    } catch (error) {
      console.error('❌ Story arcs error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'story-claim') {
    // ===== POST /api/v1/quests/story-claim { arcId, stageId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const result = await claimStoryStage(redis, userId, body?.arcId, body?.stageId);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({
        success: true,
        reward: result.reward,
        coins: result.coins,
        tickets: result.tickets,
        badge: result.badge,
        itemDrop: result.itemDrop,
        newWatchTime: result.newWatchTime,
        newLevel: result.newLevel
      });
    } catch (error) {
      console.error('❌ Story claim error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'guild-leaderboard') {
    // ===== GET /api/v1/quests/guild-leaderboard =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const leaderboard = await getGuildLeaderboard(redis);
      return res.json({ success: true, leaderboard });
    } catch (error) {
      console.error('❌ Guild leaderboard error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'hall-of-fame') {
    // ===== GET /api/v1/quests/hall-of-fame =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const history = await getBossHallOfFame(redis);
      return res.json({ success: true, history });
    } catch (error) {
      console.error('❌ Hall of fame error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Unknown action' });
  }
}
