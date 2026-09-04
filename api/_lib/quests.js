// ===== SISTEM QUEST (RPG-lite: Quest Harian & Mingguan) =====
// Satu sumber kebenaran untuk katalog quest + helper progress, dipakai oleh:
// - api/v1/quests/[...action].js (baca progress, klaim reward)
// - api/v1/history/index.js      (bump saat nonton episode / baca chapter)
// - api/v1/social/[...action].js (bump saat komentar / kirim pesan chat -- dulu terpisah di comments & chat, sekarang digabung ke social)
// - api/v1/trivia/[...action].js (bump saat main trivia)
//
// Desain: setiap quest cuma butuh SATU angka (progress) per periode (hari/minggu),
// disimpan sebagai counter Redis biasa (INCRBY), reset otomatis lewat TTL yang
// mengikuti sisa waktu periode itu. Jadi tidak ada job cron buat reset.

// PENTING: server Vercel jalan di UTC, tapi user kita WIB (UTC+7, no DST).
// Kalau hari/minggu dihitung pakai jam server (UTC) polos, reset harian/mingguan
// jatuh jam 07:00 WIB, bukan 00:00 WIB. Makanya semua helper di bawah ini
// digeser dulu ke WIB sebelum dibaca.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const nowWIB = () => new Date(Date.now() + WIB_OFFSET_MS);

export const todayStr = () => nowWIB().toISOString().slice(0, 10); // YYYY-MM-DD (WIB)

// ISO week string stabil, format: YYYY-Www (contoh: 2026-W31)
export const isoWeekStr = (d = nowWIB()) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Detik tersisa sampai akhir hari ini WIB (dipakai buat TTL counter harian)
export const secondsUntilEndOfDay = () => {
  const wib = nowWIB();
  const end = new Date(wib);
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(60, Math.floor((end - wib) / 1000));
};

// Detik tersisa sampai akhir minggu ini WIB (Minggu 23:59:59, dipakai buat TTL counter mingguan)
export const secondsUntilEndOfWeek = () => {
  const wib = nowWIB();
  const day = wib.getUTCDay(); // 0 = Minggu
  const daysLeft = day === 0 ? 0 : 7 - day;
  const end = new Date(wib);
  end.setUTCDate(wib.getUTCDate() + daysLeft);
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(60, Math.floor((end - wib) / 1000));
};

// ===== SISTEM MILESTONE PETI HARIAN (Daily Chests) =====
export const DAILY_CHESTS = [
  {
    id: 'chest_bronze',
    target: 3,
    name: 'Peti Perunggu',
    rank: 'Rank D-C',
    icon: 'Package',
    coins: 150,
    xpMinutes: 3,
    xp: 180,
    tickets: 0,
    desc: 'Buka setelah menyelesaikan 3 Quest Harian'
  },
  {
    id: 'chest_silver',
    target: 5,
    name: 'Peti Perak',
    rank: 'Rank B',
    icon: 'Gift',
    coins: 350,
    xpMinutes: 6,
    xp: 360,
    tickets: 1,
    desc: 'Buka setelah menyelesaikan 5 Quest Harian'
  },
  {
    id: 'chest_gold',
    target: 7,
    name: 'Peti Emas Legendaris',
    rank: 'Rank S',
    icon: 'Crown',
    coins: 800,
    xpMinutes: 15,
    xp: 900,
    tickets: 2,
    desc: 'Buka setelah menyelesaikan SELURUH 7 Quest Harian'
  }
];

export const chestClaimedKey = (userId, chestId) => `quest:chest:claimed:${userId}:${todayStr()}:${chestId}`;

// ===== POOL QUEST HARIAN ADVENTURER GUILD BERTINGKAT (Rank D, C, B, A, S) =====
const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', mythic: 'Mythic' };

const DAILY_POOL = [
  {
    metric: 'watch_episode',
    id: 'd_watch',
    icon: 'PlayCircle',
    title: 'Nonton Dulu, Gas!',
    tiers: [
      { tier: 'bronze', rank: 'Rank D', target: 1, reward: 180, coins: 30, desc: 'Tonton 1 episode anime apa saja' },
      { tier: 'silver', rank: 'Rank C', target: 2, reward: 360, coins: 60, desc: 'Tonton 2 episode anime apa saja' },
      { tier: 'gold', rank: 'Rank B', target: 4, reward: 720, coins: 120, desc: 'Tonton 4 episode anime apa saja' }
    ]
  },
  {
    metric: 'read_chapter',
    id: 'd_read',
    icon: 'BookOpen',
    title: 'Kutu Buku Harian',
    tiers: [
      { tier: 'bronze', rank: 'Rank D', target: 2, reward: 180, coins: 30, desc: 'Baca 2 chapter komik' },
      { tier: 'silver', rank: 'Rank C', target: 4, reward: 360, coins: 60, desc: 'Baca 4 chapter komik' },
      { tier: 'gold', rank: 'Rank B', target: 6, reward: 720, coins: 120, desc: 'Baca 6 chapter komik' }
    ]
  },
  {
    metric: 'trivia_play',
    id: 'd_trivia',
    icon: 'Brain',
    title: 'Uji Pengetahuan Anime',
    tiers: [
      { tier: 'silver', rank: 'Rank C', target: 1, reward: 240, coins: 50, desc: 'Mainkan 1 sesi trivia anime harian' }
    ]
  },
  {
    metric: 'arena_battle',
    id: 'd_arena',
    icon: 'Swords',
    title: 'Tantangan Colosseum',
    tiers: [
      { tier: 'bronze', rank: 'Rank C', target: 1, reward: 200, coins: 40, desc: 'Selesaikan 1 pertarungan di Tower / Colosseum' },
      { tier: 'silver', rank: 'Rank B', target: 2, reward: 400, coins: 80, desc: 'Selesaikan 2 pertarungan di Tower / Colosseum' },
      { tier: 'gold', rank: 'Rank A', target: 3, reward: 600, coins: 150, desc: 'Selesaikan 3 pertarungan di Tower / Colosseum' }
    ]
  },
  {
    metric: 'gacha_pull',
    id: 'd_gacha',
    icon: 'Sparkles',
    title: 'Keberuntungan Gacha',
    tiers: [
      { tier: 'silver', rank: 'Rank B', target: 1, reward: 240, coins: 50, desc: 'Lakukan 1x Summon Kartu di Gacha Arena' },
      { tier: 'gold', rank: 'Rank A', target: 2, reward: 480, coins: 120, desc: 'Lakukan 2x Summon Kartu di Gacha Arena' }
    ]
  },
  {
    metric: 'comment',
    id: 'd_comment',
    icon: 'MessageSquare',
    title: 'Kasih Pendapat',
    tiers: [
      { tier: 'bronze', rank: 'Rank D', target: 1, reward: 120, coins: 25, desc: 'Komentar di 1 episode/chapter' },
      { tier: 'silver', rank: 'Rank C', target: 2, reward: 240, coins: 50, desc: 'Komentar di 2 episode/chapter' },
      { tier: 'gold', rank: 'Rank B', target: 4, reward: 480, coins: 100, desc: 'Komentar di 4 episode/chapter' }
    ]
  },
  {
    metric: 'chat_message',
    id: 'd_chat',
    icon: 'MessageCircle',
    title: 'Say Something',
    tiers: [
      { tier: 'bronze', rank: 'Rank D', target: 3, reward: 120, coins: 25, desc: 'Kirim 3 pesan di chat komunitas' },
      { tier: 'silver', rank: 'Rank C', target: 6, reward: 240, coins: 50, desc: 'Kirim 6 pesan di chat komunitas' },
      { tier: 'gold', rank: 'Rank B', target: 10, reward: 480, coins: 100, desc: 'Kirim 10 pesan di chat komunitas' }
    ]
  }
];

const dayOfYear = (d = new Date()) => {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};

// Offset beda per metric biar tier-nya gak kompak naik bareng di hari yang sama
const METRIC_OFFSET = {
  watch_episode: 0,
  read_chapter: 1,
  comment: 2,
  chat_message: 3,
  trivia_play: 0,
  arena_battle: 4,
  gacha_pull: 5
};

// Bangun daftar quest harian "aktif hari ini" dari DAILY_POOL
export const getTodayDailyQuests = () => {
  const doy = dayOfYear();
  return DAILY_POOL.map((q) => {
    const idx = (doy + (METRIC_OFFSET[q.metric] || 0)) % q.tiers.length;
    const active = q.tiers[idx];
    return {
      id: q.id,
      period: 'daily',
      metric: q.metric,
      icon: q.icon,
      title: q.title,
      tier: active.tier,
      tierLabel: TIER_LABEL[active.tier],
      rank: active.rank || 'Rank D',
      target: active.target,
      reward: active.reward,
      coins: active.coins || 30,
      desc: active.desc
    };
  });
};

export const WEEKLY_QUESTS = [
  {
    id: 'w_watch10',
    period: 'weekly',
    metric: 'watch_episode',
    target: 10,
    title: 'Marathon Mingguan',
    desc: 'Tonton 10 episode anime minggu ini',
    icon: 'Flame',
    tier: 'mythic',
    tierLabel: 'Mythic',
    rank: 'Rank S',
    reward: 1800,
    coins: 250
  },
  {
    id: 'w_read10',
    period: 'weekly',
    metric: 'read_chapter',
    target: 10,
    title: 'Reading Spree',
    desc: 'Baca 10 chapter komik minggu ini',
    icon: 'Library',
    tier: 'mythic',
    tierLabel: 'Mythic',
    rank: 'Rank S',
    reward: 1800,
    coins: 250
  },
  {
    id: 'w_arena10',
    period: 'weekly',
    metric: 'arena_battle',
    target: 10,
    title: 'Gladiator Mingguan',
    desc: 'Selesaikan 10 pertempuran Arena Colosseum / Tower',
    icon: 'Swords',
    tier: 'mythic',
    tierLabel: 'Mythic',
    rank: 'Rank S',
    reward: 1800,
    coins: 300
  },
  {
    id: 'w_social15',
    period: 'weekly',
    metric: 'chat_message',
    target: 15,
    title: 'Ramai Terus',
    desc: 'Kirim 15 pesan di chat komunitas minggu ini',
    icon: 'Users',
    tier: 'platinum',
    tierLabel: 'Platinum',
    rank: 'Rank A',
    reward: 1200,
    coins: 180
  }
];

export const ALL_QUESTS_STATIC = [...WEEKLY_QUESTS]; // dipakai internal saja
export const getAllQuests = () => [...getTodayDailyQuests(), ...WEEKLY_QUESTS];

// Key counter progress: quest:progress:{userId}:{d|w}:{periodStr}:{metric}
export const progressKey = (userId, quest) => {
  const p = quest.period === 'weekly' ? `w:${isoWeekStr()}` : `d:${todayStr()}`;
  return `quest:progress:${userId}:${p}:${quest.metric}`;
};

// Counter permanen (tidak pernah reset) per metric, dipakai buat Quest Chain/Story Arc
export const alltimeKey = (userId, metric) => `quest:alltime:${userId}:${metric}`;

// Key status klaim: quest:claimed:{userId}:{d|w}:{periodStr}:{questId}
export const claimedKey = (userId, quest) => {
  const p = quest.period === 'weekly' ? `w:${isoWeekStr()}` : `d:${todayStr()}`;
  return `quest:claimed:${userId}:${p}:${quest.id}`;
};

// ===== BOSS EVENT KOMUNAL (mingguan) =====
// Semua user "menyerang" 1 boss bareng-bareng lewat aktivitas nonton/baca.
// Setiap episode ditonton / chapter dibaca = 1 poin damage ke boss minggu itu.
export const BOSS_TARGET = 300; // total poin damage buat ngalahin boss minggu ini
export const BOSS_METRICS = ['watch_episode', 'read_chapter'];
export const BOSS_REWARD = 900; // 15 menit XP untuk tiap kontributor kalau boss kalah

export const bossProgressKey = () => `boss:progress:${isoWeekStr()}`;
export const bossContributorsKey = () => `boss:contributors:${isoWeekStr()}`;
export const bossClaimedKey = (userId) => `boss:claimed:${userId}:${isoWeekStr()}`;
export const bossContribZKey = () => `boss:contrib:${isoWeekStr()}`;
export const bossHistoryDoneKey = () => `boss:history:done:${isoWeekStr()}`;
export const BOSS_HISTORY_LIST = 'boss:history';
export const guildBossKey = (guildId) => `guild:boss:${isoWeekStr()}:${guildId}`;

// Sumbang damage ke boss minggu ini + catat user sebagai kontributor
export async function contributeBoss(redis, userId, amount = 1) {
  if (!userId || amount <= 0) return;
  try {
    const pKey = bossProgressKey();
    const newProgress = await redis.incrby(pKey, amount);
    const ttl = await redis.ttl(pKey);
    if (ttl === -1) await redis.expire(pKey, secondsUntilEndOfWeek());

    const cKey = bossContributorsKey();
    await redis.sadd(cKey, userId);
    const cTtl = await redis.ttl(cKey);
    if (cTtl === -1) await redis.expire(cKey, secondsUntilEndOfWeek());

    // Catat skor kontribusi per user, dipakai buat Hall of Fame (siapa top contributor)
    const zKey = bossContribZKey();
    await redis.zincrby(zKey, amount, userId);
    const zTtl = await redis.ttl(zKey);
    if (zTtl === -1) await redis.expire(zKey, secondsUntilEndOfWeek());

    // Snapshot ke Hall of Fame persis saat boss PERTAMA KALI kalah minggu ini
    if (newProgress >= BOSS_TARGET && newProgress - amount < BOSS_TARGET) {
      const doneKey = bossHistoryDoneKey();
      const already = await redis.get(doneKey);
      if (!already) {
        await redis.set(doneKey, '1', { ex: secondsUntilEndOfWeek() });
        // Dynamic import biar gak circular dependency (rpg.js juga import dari file ini)
        const { getBossTheme } = await import('./rpg.js');
        const top = await redis.zrange(zKey, 0, 0, { rev: true, withScores: true });
        let topContributor = null;
        if (top && top.length >= 2) {
          const topUserId = top[0];
          const userData = await redis.get(`user:${topUserId}`);
          const u = userData ? (typeof userData === 'string' ? JSON.parse(userData) : userData) : null;
          topContributor = { id: topUserId, name: u?.name || 'User', damage: parseInt(top[1], 10) || 0 };
        }
        const contributorCount = (await redis.scard(cKey)) || 0;
        const entry = {
          week: isoWeekStr(),
          theme: getBossTheme(),
          target: BOSS_TARGET,
          defeatedAt: new Date().toISOString(),
          topContributor,
          contributorCount
        };
        await redis.lpush(BOSS_HISTORY_LIST, JSON.stringify(entry));
        await redis.ltrim(BOSS_HISTORY_LIST, 0, 19);
      }
    }
  } catch (err) {
    console.error('❌ contributeBoss error:', err);
  }
}


// Dipanggil dari endpoint lain (history, comments, chat, trivia) setiap kali
// event terkait terjadi. Aman dipanggil walau user belum login (di-skip).
export async function bumpQuestProgress(redis, userId, metric, amount = 1) {
  if (!userId || !metric) return;
  try {
    const quests = getAllQuests().filter((q) => q.metric === metric);
    for (const quest of quests) {
      const key = progressKey(userId, quest);
      const ttl = quest.period === 'weekly' ? secondsUntilEndOfWeek() : secondsUntilEndOfDay();
      await redis.incrby(key, amount);
      // Set TTL cuma kalau belum ada (biar gak reset ulang tiap increment)
      const currentTtl = await redis.ttl(key);
      if (currentTtl === -1) {
        await redis.expire(key, ttl);
      }
    }

    // Counter permanen buat Quest Chain/Story Arc (tidak pernah reset)
    await redis.incrby(alltimeKey(userId, metric), amount);

    // Metric yang sama juga jadi damage buat Boss Event komunal
    if (BOSS_METRICS.includes(metric)) {
      let bossAmount = amount;
      let guildId = null;
      try {
        const userData = await redis.get(`user:${userId}`);
        if (userData) {
          const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
          guildId = user.guildId || null;
          // Dynamic import biar gak circular dependency (rpg.js juga import dari file ini)
          const { getBossDmgBonus } = await import('./rpg.js');
          bossAmount += getBossDmgBonus(user);
        }
      } catch (e) {
        console.error('❌ getBossDmgBonus error:', e);
      }
      await contributeBoss(redis, userId, bossAmount);

      // Damage yang sama juga masuk ke skor Guild user (kalau dia gabung guild)
      if (guildId) {
        try {
          const gKey = guildBossKey(guildId);
          await redis.incrby(gKey, bossAmount);
          const gTtl = await redis.ttl(gKey);
          if (gTtl === -1) await redis.expire(gKey, secondsUntilEndOfWeek());
        } catch (e) {
          console.error('❌ guild damage bump error:', e);
        }
      }
    }
  } catch (err) {
    console.error('❌ bumpQuestProgress error:', err);
  }
}
