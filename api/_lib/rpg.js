import {
  BOSS_TARGET, BOSS_REWARD, isoWeekStr,
  bossProgressKey, bossContributorsKey, bossClaimedKey, secondsUntilEndOfWeek, alltimeKey,
  guildBossKey, BOSS_HISTORY_LIST
} from './quests.js';

// ===== CLASS / ROLE =====
// Dipilih sekali oleh user (bisa ganti kapan saja lewat action 'class' di
// api/v1/user/[...action].js). Ngasih bonus XP di quest yang sesuai fokusnya.
export const CLASSES = [
  {
    id: 'warrior',
    name: 'Warrior',
    tagline: 'Sang Penonton Sejati',
    desc: 'XP dari quest nonton episode +25%',
    icon: 'Swords',
    focusMetrics: ['watch_episode'],
    bonusPct: 25
  },
  {
    id: 'scholar',
    name: 'Scholar',
    tagline: 'Kutu Buku Komik',
    desc: 'XP dari quest baca chapter +25%',
    icon: 'BookOpenCheck',
    focusMetrics: ['read_chapter'],
    bonusPct: 25
  },
  {
    id: 'socialite',
    name: 'Socialite',
    tagline: 'Jiwa Sosial Komunitas',
    desc: 'XP dari quest chat & komentar +25%',
    icon: 'Heart',
    focusMetrics: ['chat_message', 'comment'],
    bonusPct: 25
  }
];

export const getClass = (classId) => CLASSES.find((c) => c.id === classId) || null;

// Hitung reward final quest setelah bonus class (dibulatkan ke bawah)
export const applyClassBonus = (baseReward, classId, metric) => {
  const cls = getClass(classId);
  if (!cls || !cls.focusMetrics.includes(metric)) return baseReward;
  return Math.floor(baseReward * (1 + cls.bonusPct / 100));
};

// ===== ITEM / INVENTORY =====
export const ITEMS = [
  {
    id: 'scroll_2x',
    name: 'Gulungan XP Ganda',
    desc: 'Gandakan reward XP dari quest berikutnya yang kamu klaim (aktif 1 jam)',
    icon: 'Sparkles',
    rarity: 'rare'
  },
  {
    id: 'crest_boss',
    name: 'Lencana Kontribusi',
    desc: 'Langsung sumbang +3 poin damage ke Boss Mingguan',
    icon: 'Shield',
    rarity: 'common'
  }
];

export const getItem = (itemId) => ITEMS.find((i) => i.id === itemId) || null;

// ===== SKILL TREE =====
// Setiap naik 1 level = dapat 1 skill point (dihitung on-the-fly dari level user
// dikurangi jumlah skill yang sudah di-unlock, jadi gak perlu counter terpisah).
export const SKILLS = [
  {
    id: 'efficient',
    name: 'Efisien',
    desc: '+10% XP dari semua reward quest',
    tier: 1,
    requiredLevel: 3,
    cost: 1,
    icon: 'Zap',
    effect: { type: 'xp_pct', value: 10 }
  },
  {
    id: 'fortune',
    name: 'Hoki',
    desc: '+15% peluang drop item saat klaim quest',
    tier: 1,
    requiredLevel: 5,
    cost: 1,
    icon: 'Clover',
    effect: { type: 'drop_pct', value: 15 }
  },
  {
    id: 'warmonger',
    name: 'Petarung',
    desc: '+2 damage tiap kontribusi ke Boss Event',
    tier: 2,
    requiredLevel: 7,
    cost: 1,
    icon: 'Swords',
    effect: { type: 'boss_dmg', value: 2 }
  },
  {
    id: 'scholar_mind',
    name: 'Pikiran Cerdas',
    desc: '+20% XP tambahan dari semua reward quest',
    tier: 2,
    requiredLevel: 10,
    cost: 1,
    icon: 'Brain',
    effect: { type: 'xp_pct', value: 20 }
  },
  {
    id: 'boss_hunter',
    name: 'Pemburu Boss',
    desc: '+50% reward saat Boss Event berhasil dikalahkan',
    tier: 3,
    requiredLevel: 12,
    cost: 1,
    icon: 'Trophy',
    effect: { type: 'boss_reward_pct', value: 50 }
  }
];

export const getSkill = (skillId) => SKILLS.find((s) => s.id === skillId) || null;
const unlockedIds = (user) => (user?.skills || []);

export const getAvailableSkillPoints = (user) => {
  const level = user?.level || 0;
  return Math.max(0, level - unlockedIds(user).length);
};

const sumEffect = (user, type) =>
  SKILLS.filter((s) => unlockedIds(user).includes(s.id) && s.effect.type === type)
    .reduce((sum, s) => sum + s.effect.value, 0);

export const getXpBonusPct = (user) => sumEffect(user, 'xp_pct');
export const getDropBonusPct = (user) => sumEffect(user, 'drop_pct');
export const getBossDmgBonus = (user) => sumEffect(user, 'boss_dmg');
export const getBossRewardBonusPct = (user) => sumEffect(user, 'boss_reward_pct');

// Cek + unlock 1 skill. Return { success, error? }
export async function unlockSkill(redis, userId, skillId) {
  const skill = getSkill(skillId);
  if (!skill) return { success: false, error: 'Skill tidak ditemukan' };

  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (!userData) return { success: false, error: 'User tidak ditemukan' };
  const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

  const unlocked = unlockedIds(user);
  if (unlocked.includes(skillId)) return { success: false, error: 'Skill ini sudah kamu buka' };
  if ((user.level || 0) < skill.requiredLevel) return { success: false, error: `Butuh level ${skill.requiredLevel}` };
  if (getAvailableSkillPoints(user) < skill.cost) return { success: false, error: 'Skill point tidak cukup' };

  user.skills = [...unlocked, skillId];
  await redis.set(userKey, JSON.stringify(user));
  return { success: true, skills: user.skills };
}

// Peluang drop item setiap klaim quest berhasil (30%), lalu diundi item mana
const DROP_CHANCE = 0.3;
const DROP_WEIGHTS = [
  { id: 'crest_boss', weight: 0.7 },
  { id: 'scroll_2x', weight: 0.3 }
];

export const rollItemDrop = (bonusPct = 0) => {
  const chance = DROP_CHANCE + bonusPct / 100;
  if (Math.random() > chance) return null;
  const roll = Math.random();
  let acc = 0;
  for (const w of DROP_WEIGHTS) {
    acc += w.weight;
    if (roll <= acc) return w.id;
  }
  return DROP_WEIGHTS[0].id;
};

const inventoryKey = (userId) => `inventory:${userId}`;
const boostKey = (userId) => `boost2x:${userId}`;

export async function addItem(redis, userId, itemId, qty = 1) {
  if (!userId || !itemId) return;
  await redis.hincrby(inventoryKey(userId), itemId, qty);
}

export async function getInventory(redis, userId) {
  const raw = (await redis.hgetall(inventoryKey(userId))) || {};
  return ITEMS.map((item) => ({
    ...item,
    count: parseInt(raw[item.id] || 0, 10) || 0
  })).filter((item) => item.count > 0);
}

// Konsumsi 1 item dari inventory. Return false kalau stok kosong.
export async function consumeItem(redis, userId, itemId) {
  const current = await redis.hget(inventoryKey(userId), itemId);
  const count = parseInt(current || 0, 10) || 0;
  if (count <= 0) return false;
  await redis.hincrby(inventoryKey(userId), itemId, -1);
  return true;
}

export async function activateXpBoost(redis, userId) {
  await redis.set(boostKey(userId), '1', { ex: 3600 });
}

// Cek & konsumsi boost 2x kalau lagi aktif (dipanggil pas klaim quest lain)
export async function consumeXpBoostIfActive(redis, userId) {
  const active = await redis.get(boostKey(userId));
  if (!active) return false;
  await redis.del(boostKey(userId));
  return true;
}

// ===== BOSS EVENT STATUS & KLAIM =====
// ===== TEMA BOSS MUSIMAN =====
// Nama & tagline boss ganti tiap minggu (rotasi deterministik dari nomor minggu ISO),
// biar "Boss Mingguan" gak berasa itu-itu aja terus.
const BOSS_THEMES = [
  { name: 'Raja Rebahan', tagline: 'Musuh dari alam procrastination, cuma bisa dikalahkan lewat konsistensi nonton & baca' },
  { name: 'Sang Penunda Episode', tagline: 'Muncul tiap kali watchlist makin numpuk tanpa ditonton' },
  { name: 'Iblis Cliffhanger', tagline: 'Meninggalkan rasa penasaran yang cuma bisa disembuhkan dengan lanjut baca chapter' },
  { name: 'Bayangan Backlog', tagline: 'Semakin banyak yang belum ditonton, semakin kuat dia jadi' },
  { name: 'Penguasa FOMO', tagline: 'Bikin takut ketinggalan rilisan baru, harus dikalahkan bareng-bareng' },
  { name: 'Sang Malas Login', tagline: 'Melemah tiap kali komunitas aktif ngobrol & baca bareng' }
];

const bossWeekNumber = () => {
  const [, w] = isoWeekStr().split('-W');
  return parseInt(w, 10) || 1;
};

export const getBossTheme = () => BOSS_THEMES[bossWeekNumber() % BOSS_THEMES.length];

export async function getBossStatus(redis, userId) {
  const [rawProgress, contributed, claimed] = await Promise.all([
    redis.get(bossProgressKey()),
    userId ? redis.sismember(bossContributorsKey(), userId) : Promise.resolve(0),
    userId ? redis.get(bossClaimedKey(userId)) : Promise.resolve(null)
  ]);
  const progress = Math.min(BOSS_TARGET, parseInt(rawProgress || 0, 10) || 0);
  const defeated = progress >= BOSS_TARGET;
  return {
    week: isoWeekStr(),
    theme: getBossTheme(),
    progress,
    target: BOSS_TARGET,
    defeated,
    contributed: !!contributed,
    claimed: !!claimed,
    canClaim: defeated && !!contributed && !claimed,
    reward: BOSS_REWARD
  };
}

export async function claimBossReward(redis, userId) {
  const status = await getBossStatus(redis, userId);
  if (!status.canClaim) return { success: false, status };

  await redis.set(bossClaimedKey(userId), '1', { ex: secondsUntilEndOfWeek() });

  const userData = await redis.get(`user:${userId}`);
  let newWatchTime = null;
  let newLevel = null;
  let finalReward = BOSS_REWARD;
  if (userData) {
    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
    finalReward = Math.floor(BOSS_REWARD * (1 + getBossRewardBonusPct(user) / 100));
    newWatchTime = (user.watchTime || 0) + finalReward;
    newLevel = Math.floor(newWatchTime / 600);
    user.watchTime = newWatchTime;
    user.level = newLevel;
    user.lastWatchUpdate = new Date().toISOString();
    await redis.set(`user:${userId}`, JSON.stringify(user));
    await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
  }

  return { success: true, status: { ...status, claimed: true, canClaim: false, reward: finalReward }, newWatchTime, newLevel };
}

// ===== STORY ARC / QUEST CHAIN =====
// Rangkaian quest bertema yang dikerjakan bertahap (harus urut), pakai counter
// PERMANEN (alltimeKey dari quests.js) — beda dari quest harian/mingguan yang reset.
// Stage terakhir tiap arc berisi pertarungan Bos Cerita & Badge/Item eksklusif.
export const STORY_ARCS = [
  {
    id: 'arc_astral_academy',
    name: 'Akademi Sihir & Kebangkitan Astral',
    desc: 'Permulaan perjalanan petualang muda di gerbang Akademi Astral. Kuasai mantra dasar dan hadapi Penjaga Gerbang Kuno.',
    region: 'Gerbang Akademi Astral',
    icon: 'Sparkles',
    themeColor: '#38bdf8',
    bgGradient: 'from-sky-950/40 via-[#181820] to-[#121218]',
    stages: [
      {
        id: 's1',
        metric: 'watch_episode',
        target: 5,
        title: 'Gerbang Masuk Astral',
        desc: 'Tonton 5 episode anime untuk menyerap esensi mana pertama.',
        reward: 600,
        coins: 100
      },
      {
        id: 's2',
        metric: 'read_chapter',
        target: 10,
        title: 'Arsip Mantra Terlarang',
        desc: 'Baca 10 chapter komik untuk mempelajari gulungan sihir kuno.',
        reward: 800,
        coins: 150
      },
      {
        id: 's3',
        metric: 'arena_battle',
        target: 3,
        title: 'Ujian Duel Sihir Colosseum',
        desc: 'Selesaikan 3 duel pertarungan di Arena Colosseum.',
        reward: 1000,
        coins: 200
      },
      {
        id: 's4_boss',
        isBoss: true,
        metric: 'arena_battle',
        target: 5,
        title: 'Pertarungan Bos: Golem Kuno Penjaga Gerbang',
        desc: 'Kalahkan Penjaga Gerbang Kuno dalam duel bos cerita!',
        reward: 2000,
        coins: 500,
        tickets: 1,
        badge: 'Lulusan Akademi Astral',
        boss: {
          name: 'Ancient Astral Golem',
          title: 'Penjaga Gerbang Keabadian',
          element: 'Earth',
          hp: 3500,
          maxHp: 3500,
          atk: 420,
          def: 300,
          avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300',
          skillName: 'Earthquake Slam',
          skillDesc: 'Menghantam tanah dan menghasilkan gempa dahsyat yang mengguncang seluruh deck!',
          introQuote: 'Siapa yang berani melangkah ke wilayah terlarang Akademi Astral tanpa izin?!',
          defeatQuote: 'Luar biasa... kekuatan mana milikmu telah melampaui ujian ini, Petualang.'
        }
      }
    ]
  },
  {
    id: 'arc_cursed_forest',
    name: 'Hutan Kutukan & Bayangan Void',
    desc: 'Menembus kabut beracun dan memurnikan energi kutukan jahat yang merasuki hutan rimba kuno.',
    region: 'Hutan Kabut Hitam',
    icon: 'Flame',
    themeColor: '#a855f7',
    bgGradient: 'from-purple-950/40 via-[#181820] to-[#121218]',
    stages: [
      {
        id: 's1',
        metric: 'watch_episode',
        target: 15,
        title: 'Menembus Kabut Beracun',
        desc: 'Tonton 15 episode anime untuk bertahan di tengah racun kutukan.',
        reward: 1200,
        coins: 250
      },
      {
        id: 's2',
        metric: 'read_chapter',
        target: 25,
        title: 'Pencarian Bunga Penyembuh',
        desc: 'Baca 25 chapter komik untuk meramu penawar racun hutan.',
        reward: 1500,
        coins: 300
      },
      {
        id: 's3',
        metric: 'chat_message',
        target: 30,
        title: 'Sinyal Api Perkemahan',
        desc: 'Kirim 30 pesan di chat komunitas untuk memandu petualang lain.',
        reward: 1200,
        coins: 250
      },
      {
        id: 's4_boss',
        isBoss: true,
        metric: 'arena_battle',
        target: 8,
        title: 'Pertarungan Bos: Iblis Bayangan Malam',
        desc: 'Kalahkan Roh Kutukan Penguasa Hutan yang bersembunyi dalam kegelapan!',
        reward: 3500,
        coins: 800,
        tickets: 2,
        badge: 'Penakluk Bayangan Void',
        boss: {
          name: 'Shadow Wraith Nocturne',
          title: 'Penguasa Kutukan Abyssal',
          element: 'Dark',
          hp: 6500,
          maxHp: 6500,
          atk: 680,
          def: 450,
          avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300',
          skillName: 'Abyssal Void Grip',
          skillDesc: 'Menarik jiwa musuh ke dimensi kegelapan dan mencuri armor pertahanan!',
          introQuote: 'Jiwa kalian akan tenggelam dalam kegelapan hutan ini selamanya...',
          defeatQuote: 'Cahaya itu... bagaimana mungkin kau memecahkan kutukan ratusan tahun ini?!'
        }
      }
    ]
  },
  {
    id: 'arc_thunder_peak',
    name: 'Puncak Halilintar & Badai Astral',
    desc: 'Mendaki tebing gunung berpetir dan menantang Sang Naga Guntur Astral di sarang ketinggian.',
    region: 'Puncak Gunung Raijin',
    icon: 'Zap',
    themeColor: '#eab308',
    bgGradient: 'from-amber-950/40 via-[#181820] to-[#121218]',
    stages: [
      {
        id: 's1',
        metric: 'watch_episode',
        target: 35,
        title: 'Menembus Badai Petir',
        desc: 'Tonton 35 episode anime dalam perjalanan mendaki puncak badai.',
        reward: 2500,
        coins: 500
      },
      {
        id: 's2',
        metric: 'read_chapter',
        target: 45,
        title: 'Naskah Kuno Sang Penjinak',
        desc: 'Baca 45 chapter komik untuk menguak kelemahan elemen naga.',
        reward: 2800,
        coins: 600
      },
      {
        id: 's3',
        metric: 'arena_battle',
        target: 12,
        title: 'Latihan Tempur di Tebing Langit',
        desc: 'Menangkan atau selesaikan 12 duel pertempuran di Colosseum.',
        reward: 3000,
        coins: 700
      },
      {
        id: 's4_boss',
        isBoss: true,
        metric: 'arena_battle',
        target: 15,
        title: 'Pertarungan Bos: Naga Guntur Raijin',
        desc: 'Taklukkan Naga Penjaga Langit dalam pertarungan legendaris!',
        reward: 5000,
        coins: 1200,
        tickets: 3,
        itemDrop: 'scroll_2x',
        badge: 'Penunggang Naga Raijin',
        boss: {
          name: 'Raijin Storm Drake',
          title: 'Penguasa Halilintar Langit Ke-7',
          element: 'Light',
          hp: 11000,
          maxHp: 11000,
          atk: 1050,
          def: 750,
          avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300',
          skillName: 'Cataclysmic Thunderstorm',
          skillDesc: 'Memanggil jutaan kilatan petir plasma yang membakar seluruh arena tempur!',
          introQuote: 'RAAAWR! Siapa makhluk fana yang berani menodai takhta petirku?!',
          defeatQuote: 'Keberanian dan kekompakan kartumu... aku akui kau sebagai tuanku!'
        }
      }
    ]
  },
  {
    id: 'arc_demon_citadel',
    name: 'Benteng Takhta Raja Iblis Abadi',
    desc: 'Perang puncak terakhir. Gempur benteng kegelapan dan kalahkan Raja Iblis Abadi untuk menyelamatkan dunia Nefora!',
    region: 'Kastil Kegelapan Abadi',
    icon: 'Crown',
    themeColor: '#ef4444',
    bgGradient: 'from-rose-950/40 via-[#181820] to-[#121218]',
    stages: [
      {
        id: 's1',
        metric: 'watch_episode',
        target: 60,
        title: 'Serbuan Menembus Gerbang Neraka',
        desc: 'Tonton 60 episode anime untuk menghancurkan barikade legiun iblis.',
        reward: 4000,
        coins: 1000
      },
      {
        id: 's2',
        metric: 'read_chapter',
        target: 70,
        title: 'Mengurai Mantra Penghalang Takhta',
        desc: 'Baca 70 chapter komik untuk melenyapkan segel pelindung Raja Iblis.',
        reward: 4500,
        coins: 1200
      },
      {
        id: 's3',
        metric: 'comment',
        target: 25,
        title: 'Seruan Semangat Pasukan Sekutu',
        desc: 'Beri 25 komentar di anime & komik untuk mengobarkan bara perlawanan.',
        reward: 3500,
        coins: 800
      },
      {
        id: 's4_boss',
        isBoss: true,
        metric: 'arena_battle',
        target: 20,
        title: 'Pertarungan Puncak: Raja Iblis Abadi Lucifer',
        desc: 'Pertarungan pamungkas melawan penguasa absolut kegelapan!',
        reward: 10000,
        coins: 3000,
        tickets: 5,
        itemDrop: 'scroll_2x',
        badge: 'Penyelamat Alam Nefora',
        boss: {
          name: 'The Eternal Demon Sovereign',
          title: 'Raja Mutlak Kegelapan Semesta',
          element: 'Void',
          hp: 20000,
          maxHp: 20000,
          atk: 1650,
          def: 1100,
          avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
          skillName: 'Omnipresent Armageddon',
          skillDesc: 'Menghancurkan struktur realitas dan membangkitkan kehancuran kosmik!',
          introQuote: 'Berlututlah di hadapanku! Takhta ini tidak akan pernah runtuh oleh siapapun!',
          defeatQuote: 'Tidak mungkin... Takhtaku... Dunia ini... milik kalian...'
        }
      }
    ]
  }
];

const arcClaimedKey = (userId, arcId, stageId) => `arc:claimed:${userId}:${arcId}:${stageId}`;

export async function getStoryArcsStatus(redis, userId) {
  const results = [];
  for (const arc of STORY_ARCS) {
    let prevClaimed = true; // stage pertama selalu "terbuka" duluan
    const stages = [];
    for (const stage of arc.stages) {
      const [rawProgress, claimedRaw] = await Promise.all([
        userId ? redis.get(alltimeKey(userId, stage.metric)) : Promise.resolve(0),
        userId ? redis.get(arcClaimedKey(userId, arc.id, stage.id)) : Promise.resolve(null)
      ]);
      const progress = Math.min(stage.target, parseInt(rawProgress || 0, 10) || 0);
      const claimed = !!claimedRaw;
      const locked = !prevClaimed;
      stages.push({
        ...stage,
        progress,
        completed: progress >= stage.target,
        claimed,
        locked,
        canClaim: !locked && !claimed && progress >= stage.target
      });
      prevClaimed = claimed;
    }
    results.push({
      id: arc.id,
      name: arc.name,
      desc: arc.desc,
      region: arc.region,
      icon: arc.icon,
      themeColor: arc.themeColor,
      bgGradient: arc.bgGradient,
      stages,
      finished: stages.every((s) => s.claimed)
    });
  }
  return results;
}

export async function claimStoryStage(redis, userId, arcId, stageId) {
  const arc = STORY_ARCS.find((a) => a.id === arcId);
  if (!arc) return { success: false, error: 'Arc tidak ditemukan' };
  const stageIndex = arc.stages.findIndex((s) => s.id === stageId);
  if (stageIndex === -1) return { success: false, error: 'Stage tidak ditemukan' };
  const stage = arc.stages[stageIndex];

  // Validasi urutan: stage sebelumnya (kalau ada) harus sudah diklaim
  if (stageIndex > 0) {
    const prevStage = arc.stages[stageIndex - 1];
    const prevClaimed = await redis.get(arcClaimedKey(userId, arcId, prevStage.id));
    if (!prevClaimed) return { success: false, error: 'Selesaikan stage sebelumnya dulu' };
  }

  const cKey = arcClaimedKey(userId, arcId, stageId);
  const alreadyClaimed = await redis.get(cKey);
  if (alreadyClaimed) return { success: false, error: 'Stage ini sudah diklaim' };

  const rawProgress = await redis.get(alltimeKey(userId, stage.metric));
  const progress = parseInt(rawProgress || 0, 10) || 0;
  if (progress < stage.target) return { success: false, error: 'Progress stage belum cukup' };

  await redis.set(cKey, '1'); // permanen, gak ada TTL

  const userKeyStr = `user:${userId}`;
  const userData = await redis.get(userKeyStr);
  let newWatchTime = null;
  let newLevel = null;
  if (userData) {
    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
    newWatchTime = (user.watchTime || 0) + (stage.reward || 0);
    newLevel = Math.floor(newWatchTime / 600);
    user.watchTime = newWatchTime;
    user.level = newLevel;
    user.coins = (user.coins || 0) + (stage.coins || 0);
    user.lastWatchUpdate = new Date().toISOString();
    if (stage.badge) {
      user.storyBadges = Array.from(new Set([...(user.storyBadges || []), stage.badge]));
    }
    await redis.set(userKeyStr, JSON.stringify(user));
    await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
  }

  // Tambahkan koin & tiket ke gacha stats
  const gachaKey = `user:gacha_stats:${userId}`;
  const rawGacha = await redis.get(gachaKey);
  if (rawGacha) {
    const gStats = typeof rawGacha === 'string' ? JSON.parse(rawGacha) : rawGacha;
    gStats.coins = (gStats.coins || 0) + (stage.coins || 0);
    gStats.tickets = (gStats.tickets || 0) + (stage.tickets || 0);
    await redis.set(gachaKey, JSON.stringify(gStats));
  }

  // Tambahkan item jika ada
  if (stage.itemDrop) {
    await addItem(redis, userId, stage.itemDrop, 1);
  }

  return {
    success: true,
    reward: stage.reward,
    coins: stage.coins || 0,
    tickets: stage.tickets || 0,
    badge: stage.badge || null,
    itemDrop: stage.itemDrop || null,
    newWatchTime,
    newLevel
  };
}

// ===== GUILD / PARTY =====
// User gabung salah satu guild (mirip Class, bisa ganti kapan saja). Damage
// tiap kontribusi ke Boss Event juga otomatis ke-akumulasi ke skor guild-nya
// (lihat api/_lib/quests.js -> bumpQuestProgress), jadi ada leaderboard tim.
export const GUILDS = [
  { id: 'crimson', name: 'Crimson Vanguard', tagline: 'Garda Terdepan', color: '#ef4444', icon: 'Flame' },
  { id: 'azure', name: 'Azure Wardens', tagline: 'Penjaga Ketenangan', color: '#3b82f6', icon: 'Waves' },
  { id: 'emerald', name: 'Emerald Nomads', tagline: 'Penjelajah Bebas', color: '#10b981', icon: 'Leaf' },
  { id: 'violet', name: 'Violet Enigma', tagline: 'Misteri yang Memikat', color: '#a855f7', icon: 'Sparkle' }
];

export const getGuildDef = (guildId) => GUILDS.find((g) => g.id === guildId) || null;

export async function setUserGuild(redis, userId, guildId) {
  if (!GUILDS.some((g) => g.id === guildId)) return { success: false, error: 'Guild tidak valid' };
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (!userData) return { success: false, error: 'User tidak ditemukan' };
  const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
  user.guildId = guildId;
  await redis.set(userKey, JSON.stringify(user));
  return { success: true, guildId };
}

// Leaderboard guild minggu ini, diurutkan dari damage terbesar
export async function getGuildLeaderboard(redis) {
  const scores = await Promise.all(GUILDS.map((g) => redis.get(guildBossKey(g.id))));
  return GUILDS.map((g, i) => ({ ...g, damage: parseInt(scores[i] || 0, 10) || 0 }))
    .sort((a, b) => b.damage - a.damage);
}

// ===== HALL OF FAME BOSS =====
// Riwayat boss yang udah dikalahkan tiap minggu (snapshot otomatis, lihat
// contributeBoss di quests.js), disimpan permanen (20 entri terakhir).
export async function getBossHallOfFame(redis) {
  const raw = (await redis.lrange(BOSS_HISTORY_LIST, 0, 19)) || [];
  return raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}


