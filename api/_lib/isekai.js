import { gachaStatsKey, userCardsKey, userDeckKey } from './cards.js';
import { getCardById } from '../../src/utils/cardsData.js';

// Format tanggal WIB
const nowWIB = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
};

// 8 Wilayah Benua Isekai lengkap dengan Guardian Penjaga, Buff Permanen, & Syarat Nyata
export const ISEKAI_REALMS = [
  {
    id: 'realm_ninja',
    name: 'Hidden Valley of Ninja',
    indonesianTitle: 'Lembah Ninja Tersembunyi',
    landmark: 'Puncak Monumen Hokage',
    genres: ['Action', 'Ninja', 'Shounen'],
    minLevel: 5,
    minCards: 3,
    reqDesc: 'Level RPG minimal Lv. 5 & memiliki minimal 3 kartu karakter',
    guardian: {
      name: 'Uchiha Sasuke (Shadow Avenger)',
      title: 'Penjaga Lembah Ninja',
      element: 'Flame',
      hp: 18000,
      atk: 1200,
      avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
      skill: 'Chidori Stream'
    },
    buff: {
      id: 'buff_ninja',
      name: 'Shinobi Agility',
      desc: '+10% Bonus Attack di Battle Arena'
    },
    icon: 'Flame',
    color: '#10b981',
    bgGradient: 'from-emerald-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_ninja',
    stampTitle: 'Shadow Shinobi Mark',
    title: 'Shadow Shinobi',
    desc: 'Lembah rimbun di balik kabut abadi tempat para kesatria bayangan melatih jutsu rahasia.',
    rewards: { coins: 1000, tickets: 1, xp: 1500, title: 'Shadow Shinobi' },
    coordinates: { x: 18, y: 32 }
  },
  {
    id: 'realm_clover',
    name: 'Grand Clover Magic Kingdom',
    indonesianTitle: 'Kerajaan Sihir Clover Kuno',
    landmark: 'Kuil Grimoire Astral',
    genres: ['Fantasy', 'Magic', 'Isekai'],
    minLevel: 7,
    minCards: 5,
    reqDesc: 'Level RPG minimal Lv. 7 & memiliki minimal 5 kartu karakter',
    guardian: {
      name: 'Lumiere Silvamillion',
      title: 'Pangeran Sihir Pertama',
      element: 'Light',
      hp: 28000,
      atk: 1800,
      avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
      skill: 'Light Magic: Sword of Judgement'
    },
    buff: {
      id: 'buff_clover',
      name: 'Astral Wisdom',
      desc: '+15% EXP saat menonton anime & membaca manga'
    },
    icon: 'Sparkles',
    color: '#38bdf8',
    bgGradient: 'from-sky-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_clover',
    stampTitle: 'Archmage of Clover Seal',
    title: 'Archmage of Clover',
    desc: 'Kerajaan megah bertahtakan menara kristal sihir tempat grimoire kuno memilih tuannya.',
    rewards: { coins: 1200, tickets: 1, xp: 1800, title: 'Archmage of Clover' },
    coordinates: { x: 42, y: 20 }
  },
  {
    id: 'realm_titan',
    name: 'Wall Titan Paradise',
    indonesianTitle: 'Benteng Dinding Paradis',
    landmark: 'Gerbang Tembok Maria',
    genres: ['Dark Fantasy', 'Military', 'Survival', 'Horror'],
    minLevel: 9,
    minCards: 8,
    reqDesc: 'Level RPG minimal Lv. 9 & memiliki minimal 8 kartu karakter',
    guardian: {
      name: 'Armored Titan Reiner',
      title: 'Perisai Baja Dinding Kuno',
      element: 'Earth',
      hp: 42000,
      atk: 2500,
      avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      skill: 'Titan Armor Charge'
    },
    buff: {
      id: 'buff_titan',
      name: 'Titan Fortress Will',
      desc: '+20% Damage Serangan di World Boss Raid'
    },
    icon: 'Shield',
    color: '#ef4444',
    bgGradient: 'from-red-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_titan',
    stampTitle: 'Survey Corps Vanguard Crest',
    title: 'Survey Corps Vanguard',
    desc: 'Benteng raksasa setinggi 50 meter yang melindungi sisa peradaban dari ancaman titan.',
    rewards: { coins: 1500, tickets: 1, xp: 2200, title: 'Survey Corps Vanguard' },
    coordinates: { x: 75, y: 28 }
  },
  {
    id: 'realm_cyber',
    name: 'Neo Tokyo Cyber District',
    indonesianTitle: 'Distrik Siber Neo Tokyo',
    landmark: 'Menara Hologram Shibuya',
    genres: ['Sci-Fi', 'Cyberpunk', 'Mecha'],
    minLevel: 11,
    minCoins: 1000,
    reqDesc: 'Level RPG minimal Lv. 11 & memiliki saldo minimal 1,000 Koin Gacha',
    guardian: {
      name: 'Adam Smasher Cybernetic',
      title: 'Algojo Siber Arasaka',
      element: 'Dark',
      hp: 60000,
      atk: 3200,
      avatar: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
      skill: 'Cyberware Sandevistan Blast'
    },
    buff: {
      id: 'buff_cyber',
      name: 'Market Hack Protocol',
      desc: 'Diskon 5% Koin saat Beli Instan di Pasar Lelang Kartu'
    },
    icon: 'Zap',
    color: '#a855f7',
    bgGradient: 'from-purple-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_cyber',
    stampTitle: 'Netrunner Cybernetic Seal',
    title: 'Cyber Netrunner',
    desc: 'Megacity futuristik bermandikan cahaya neon laser dan distorsi jaringan siber tak terbatas.',
    rewards: { coins: 1200, tickets: 1, xp: 1800, title: 'Cyber Netrunner' },
    coordinates: { x: 82, y: 65 }
  },
  {
    id: 'realm_soul',
    name: 'Soul Society Spirit Sanctuary',
    indonesianTitle: 'Alam Jiwa Soul Society',
    landmark: 'Kuil Seireitei Putih',
    genres: ['Supernatural', 'Super Power', 'Demons'],
    minLevel: 13,
    minCards: 10,
    reqDesc: 'Level RPG minimal Lv. 13 & memiliki minimal 10 kartu karakter',
    guardian: {
      name: 'Byakuya Kuchiki (Bankai)',
      title: 'Kapten Divisi 6 Seireitei',
      element: 'Light',
      hp: 85000,
      atk: 4000,
      avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
      skill: 'Senbonzakura Kageyoshi'
    },
    buff: {
      id: 'buff_soul',
      name: 'Zanpakuto Resonance',
      desc: '+10% Critical Strike Chance di Pertarungan Kartu'
    },
    icon: 'Swords',
    color: '#d4a73c',
    bgGradient: 'from-amber-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_soul',
    stampTitle: 'Gotei Captain Zanpakuto Mark',
    title: 'Gotei Captain',
    desc: 'Dimensi spiritual suci di mana para Shinigami menjaga keseimbangan jiwa dan dunia nyata.',
    rewards: { coins: 1500, tickets: 2, xp: 2500, title: 'Gotei Captain' },
    coordinates: { x: 52, y: 55 }
  },
  {
    id: 'realm_pirate',
    name: 'Grand Pirate Archipelagos',
    indonesianTitle: 'Kepulauan Bajak Laut Samudra Luas',
    landmark: 'Pelabuhan Loguetown',
    genres: ['Adventure', 'Historical'],
    minLevel: 15,
    minRealms: 3,
    reqDesc: 'Level RPG minimal Lv. 15 & menaklukkan minimal 3 wilayah lain sebelumnya',
    guardian: {
      name: 'Red-Haired Shanks',
      title: 'Yonko Penguasa Haki Samudra',
      element: 'Flame',
      hp: 110000,
      atk: 5200,
      avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
      skill: 'Divine Departure: Conqueror Burst'
    },
    buff: {
      id: 'buff_pirate',
      name: 'Conqueror Treasure Bounty',
      desc: '+15% Koin Kuno dari Hadiah Ekspedisi & Misi Klan'
    },
    icon: 'Anchor',
    color: '#06b6d4',
    bgGradient: 'from-cyan-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_pirate',
    stampTitle: 'Grand Line Explorer Seal',
    title: 'King of the Seas',
    desc: 'Gugusan pulau legendaris penuh misteri di tengah lautan badai tanpa akhir.',
    rewards: { coins: 1800, tickets: 2, xp: 2800, title: 'King of the Seas' },
    coordinates: { x: 25, y: 72 }
  },
  {
    id: 'realm_romance',
    name: 'Cherry Blossom Romance Academy',
    indonesianTitle: 'Akademi Romansa Bunga Sakura',
    landmark: 'Taman Sakura Senja',
    genres: ['Romance', 'Slice of Life', 'School', 'Comedy'],
    minLevel: 16,
    minRealms: 4,
    reqDesc: 'Level RPG minimal Lv. 16 & menaklukkan minimal 4 wilayah lain sebelumnya',
    guardian: {
      name: 'Kaguya Shinomiya (Ice Heart)',
      title: 'Ratu Jenius Akademi Shuchiin',
      element: 'Water',
      hp: 135000,
      atk: 6000,
      avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      skill: 'Love War: O Kawaii Koto'
    },
    buff: {
      id: 'buff_romance',
      name: 'Blossom Devotion',
      desc: '+25% Bonus Koin dari Daily Login Streak'
    },
    icon: 'Heart',
    color: '#f43f5e',
    bgGradient: 'from-pink-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_romance',
    stampTitle: 'Spring Romance Sovereign Mark',
    title: 'Spring Romance Sovereign',
    desc: 'Lembah musim semi abadi yang dipenuhi kelopak sakura gugur dan kisah kasih masa muda.',
    rewards: { coins: 1000, tickets: 1, xp: 1500, title: 'Spring Romance Sovereign' },
    coordinates: { x: 50, y: 85 }
  },
  {
    id: 'realm_void',
    name: 'Void Abyssal Domain',
    indonesianTitle: 'Domain Dimensi Void Tertinggi',
    landmark: 'Gerbang Singularitas Void',
    genres: ['Psychological', 'Mystery', 'Thriller'],
    minLevel: 18,
    minRealms: 7,
    isApex: true,
    reqDesc: 'WAJIB menaklukkan KE-7 WILAYAH LAINNYA & Level RPG minimal Lv. 18!',
    guardian: {
      name: 'Void Sovereign Lucifer',
      title: 'Penguasa Singularitas Dimensi Void',
      element: 'Void',
      hp: 200000,
      atk: 8000,
      avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
      skill: 'Dimension Collapse: Singularity'
    },
    buff: {
      id: 'buff_void',
      name: 'Cosmic Dominance',
      desc: 'Meningkatkan SEMUA efek buff di atas sebesar +10% & Aura Gelar Kosmik'
    },
    icon: 'Crown',
    color: '#8b5cf6',
    bgGradient: 'from-violet-950/80 via-[#14141d] to-[#14141d]',
    stampId: 'stamp_void',
    stampTitle: 'Supreme Dimension Walker Seal',
    title: 'Supreme Dimension Walker',
    desc: 'Pusat distorsi dimensi kosmik yang hanya bisa diakses oleh penjelajah lintas dunia sejati.',
    rewards: { coins: 3000, tickets: 3, xp: 5000, title: 'Supreme Dimension Walker' },
    coordinates: { x: 50, y: 40 }
  }
];

export const isekaiPassportKey = (userId) => `user:isekai_passport:${userId}`;

// Hitung Peringkat Paspor Isekai berdasarkan total wilayah yang ditaklukkan
export const calculatePassportRank = (totalConquered) => {
  if (totalConquered >= 8) return { rank: 'SSS-Rank Cosmic Sovereign', color: '#8b5cf6' };
  if (totalConquered >= 6) return { rank: 'SS-Rank Dimensional Conqueror', color: '#d4a73c' };
  if (totalConquered >= 4) return { rank: 'S-Rank Elite Realm Traveler', color: '#38bdf8' };
  if (totalConquered >= 2) return { rank: 'A-Rank Veteran Explorer', color: '#10b981' };
  if (totalConquered >= 1) return { rank: 'B-Rank Novice Adventurer', color: '#94a3b8' };
  return { rank: 'Novice Wanderer', color: '#64748b' };
};

// Ambil info user lengkap
async function getUserBrief(redis, userId) {
  const raw = await redis.get(`user:${userId}`);
  if (!raw) return { id: userId, name: 'Petualang Isekai', picture: null, level: 1, title: 'Anime Newbie', isekaiRank: null, joinedAt: Date.now() };
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    id: userId,
    name: u.name || 'Petualang Isekai',
    picture: u.picture || null,
    level: u.level || 1,
    title: u.title || 'Anime Newbie',
    isekaiRank: u.isekaiRank || null,
    joinedAt: u.createdAt || Date.now()
  };
}

// ===== 1. GET USER ISEKAI PASSPORT & MAP STATUS =====
export async function getUserIsekaiPassport(redis, userId) {
  const pKey = isekaiPassportKey(userId);
  const [rawPassport, user, rawCards, rawGStats] = await Promise.all([
    redis.get(pKey),
    getUserBrief(redis, userId),
    redis.get(userCardsKey(userId)),
    redis.get(gachaStatsKey(userId))
  ]);

  let passport = rawPassport ? (typeof rawPassport === 'string' ? JSON.parse(rawPassport) : rawPassport) : {
    conqueredRealms: {},
    stamps: [],
    totalConquered: 0,
    activeBuffs: []
  };

  const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
  const totalCardsCount = Object.keys(userCards).length;
  const gStats = rawGStats ? (typeof rawGStats === 'string' ? JSON.parse(rawGStats) : rawGStats) : { coins: 0 };
  const userCoins = gStats.coins || 0;
  const userLevel = user.level || 1;

  // Hitung berapa wilayah yang sudah diclaim
  let totalConqueredCount = 0;
  const activeBuffs = [];
  for (const r of ISEKAI_REALMS) {
    if (passport.conqueredRealms?.[r.id]?.claimed) {
      totalConqueredCount += 1;
      if (r.buff) activeBuffs.push(r.buff);
    }
  }

  // Evaluasi setiap wilayah berdasarkan kriteria nyata
  const realmsWithStatus = ISEKAI_REALMS.map((realm) => {
    const realmData = passport.conqueredRealms?.[realm.id] || {};
    const isClaimed = !!realmData.claimed;

    let meetsRequirements = false;
    let lockReason = null;

    if (isClaimed) {
      meetsRequirements = true;
    } else {
      if (realm.id === 'realm_ninja') {
        meetsRequirements = userLevel >= 5 && totalCardsCount >= 3;
        if (!meetsRequirements) lockReason = `Butuh Level RPG Lv. 5 (${userLevel}/5) & 3 Kartu (${totalCardsCount}/3)`;
      } else if (realm.id === 'realm_clover') {
        meetsRequirements = userLevel >= 7 && totalCardsCount >= 5;
        if (!meetsRequirements) lockReason = `Butuh Level RPG Lv. 7 (${userLevel}/7) & 5 Kartu (${totalCardsCount}/5)`;
      } else if (realm.id === 'realm_titan') {
        meetsRequirements = userLevel >= 9 && totalCardsCount >= 8;
        if (!meetsRequirements) lockReason = `Butuh Level RPG Lv. 9 (${userLevel}/9) & 8 Kartu (${totalCardsCount}/8)`;
      } else if (realm.id === 'realm_cyber') {
        meetsRequirements = userLevel >= 11 && userCoins >= 1000;
        if (!meetsRequirements) lockReason = `Butuh Level RPG Lv. 11 (${userLevel}/11) & 1,000 Koin (${userCoins.toLocaleString()}/1,000)`;
      } else if (realm.id === 'realm_soul') {
        meetsRequirements = userLevel >= 13 && totalCardsCount >= 10;
        if (!meetsRequirements) lockReason = `Butuh Level RPG Lv. 13 (${userLevel}/13) & 10 Kartu (${totalCardsCount}/10)`;
      } else if (realm.id === 'realm_pirate') {
        meetsRequirements = userLevel >= 15 && totalConqueredCount >= 3;
        if (!meetsRequirements) lockReason = `Butuh Level Lv. 15 (${userLevel}/15) & 3 Wilayah Tertaklukkan (${totalConqueredCount}/3)`;
      } else if (realm.id === 'realm_romance') {
        meetsRequirements = userLevel >= 16 && totalConqueredCount >= 4;
        if (!meetsRequirements) lockReason = `Butuh Level Lv. 16 (${userLevel}/16) & 4 Wilayah Tertaklukkan (${totalConqueredCount}/4)`;
      } else if (realm.id === 'realm_void') {
        meetsRequirements = userLevel >= 18 && totalConqueredCount >= 7;
        if (!meetsRequirements) lockReason = `WAJIB menaklukkan 7 wilayah lain (${totalConqueredCount}/7) & Level Lv. 18 (${userLevel}/18)`;
      }
    }

    return {
      ...realm,
      isClaimed,
      isLocked: !meetsRequirements && !isClaimed,
      lockReason,
      isReadyToClaim: meetsRequirements && !isClaimed,
      conqueredAt: realmData.conqueredAt || null
    };
  });

  const rankInfo = calculatePassportRank(totalConqueredCount);

  return {
    success: true,
    user,
    passport: {
      passportNo: `ISK-${userId.slice(-6).toUpperCase()}-${new Date(user.joinedAt).getFullYear()}`,
      rank: rankInfo.rank,
      rankColor: rankInfo.color,
      totalConquered: totalConqueredCount,
      totalRealms: ISEKAI_REALMS.length,
      stamps: passport.stamps || [],
      activeBuffs
    },
    realms: realmsWithStatus
  };
}

// ===== 2. CHALLENGE GUARDIAN & CLAIM CONQUERED REALM =====
export async function claimIsekaiRealm(redis, userId, realmId) {
  const realm = ISEKAI_REALMS.find((r) => r.id === realmId);
  if (!realm) return { success: false, error: 'Wilayah Isekai tidak ditemukan' };

  const pKey = isekaiPassportKey(userId);
  const [rawPassport, user, rawCards, rawGStats, rawDeck] = await Promise.all([
    redis.get(pKey),
    getUserBrief(redis, userId),
    redis.get(userCardsKey(userId)),
    redis.get(gachaStatsKey(userId)),
    redis.get(userDeckKey(userId))
  ]);

  const passport = rawPassport ? (typeof rawPassport === 'string' ? JSON.parse(rawPassport) : rawPassport) : {
    conqueredRealms: {},
    stamps: [],
    totalConquered: 0
  };

  passport.conqueredRealms = passport.conqueredRealms || {};
  if (passport.conqueredRealms[realmId]?.claimed) {
    return { success: false, error: 'Wilayah ini sudah pernah kamu taklukkan dan stempel telah diklaim!' };
  }

  const userCards = rawCards ? (typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards) : {};
  const totalCardsCount = Object.keys(userCards).length;
  const gStats = rawGStats ? (typeof rawGStats === 'string' ? JSON.parse(rawGStats) : rawGStats) : { coins: 0 };
  const userCoins = gStats.coins || 0;
  const userLevel = user.level || 1;
  const totalConquered = Object.values(passport.conqueredRealms).filter((r) => r.claimed).length;

  // Verifikasi Kriteria
  let eligible = false;
  if (realm.id === 'realm_ninja') eligible = userLevel >= 5 && totalCardsCount >= 3;
  else if (realm.id === 'realm_clover') eligible = userLevel >= 7 && totalCardsCount >= 5;
  else if (realm.id === 'realm_titan') eligible = userLevel >= 9 && totalCardsCount >= 8;
  else if (realm.id === 'realm_cyber') eligible = userLevel >= 11 && userCoins >= 1000;
  else if (realm.id === 'realm_soul') eligible = userLevel >= 13 && totalCardsCount >= 10;
  else if (realm.id === 'realm_pirate') eligible = userLevel >= 15 && totalConquered >= 3;
  else if (realm.id === 'realm_romance') eligible = userLevel >= 16 && totalConquered >= 4;
  else if (realm.id === 'realm_void') eligible = userLevel >= 18 && totalConquered >= 7;

  if (!eligible) {
    return { success: false, error: `Syarat penaklukan belum terpenuhi: ${realm.reqDesc}` };
  }

  // Ambil kartu user untuk Ujian Pertarungan Guardian
  let battleCards = [];
  if (rawDeck) {
    try {
      const parsedDeck = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
      if (Array.isArray(parsedDeck) && parsedDeck.length > 0) battleCards = parsedDeck;
    } catch {}
  }
  if (battleCards.length === 0 && rawCards) {
    try {
      const allCards = Object.values(userCards).map((c) => ({
        ...getCardById(c.id),
        ...c
      })).filter(Boolean);
      allCards.sort((a, b) => (b.attack || 500) - (a.attack || 500));
      battleCards = allCards.slice(0, 3);
    } catch {}
  }

  // Simulasi 3 Ronde Pertarungan Melawan Guardian Wilayah
  const guardian = realm.guardian;
  let playerTotalDmg = 0;
  const combatRounds = [];

  for (let r = 1; r <= 3; r++) {
    const card = battleCards[(r - 1) % Math.max(1, battleCards.length)] || {
      name: user.name,
      attack: (user.level || 1) * 1200 + 4000
    };
    const baseAtk = card.attack || 1500;
    const isCrit = Math.random() < 0.35;
    const mult = isCrit ? 1.8 : 1.2;
    const dmg = Math.round(baseAtk * 4.5 * mult);
    playerTotalDmg += dmg;

    combatRounds.push({
      round: r,
      cardName: card.name,
      damage: dmg,
      crit: isCrit,
      guardianSkill: r === 2 ? guardian.skill : null
    });
  }

  // Jika damage pemain melebihi HP Guardian -> Menang Telak!
  // Jika kurang, tambahkan bonus kekuatan petualang agar tantangan adil namun seru
  const finalDamage = Math.max(playerTotalDmg, guardian.hp + 2500);

  // Tandai klaim wilayah
  const now = Date.now();
  passport.conqueredRealms[realmId] = {
    claimed: true,
    conqueredAt: now
  };

  if (!passport.stamps.includes(realm.stampId)) {
    passport.stamps.push(realm.stampId);
  }

  const newTotalConquered = Object.values(passport.conqueredRealms).filter((r) => r.claimed).length;
  passport.totalConquered = newTotalConquered;
  const rankInfo = calculatePassportRank(newTotalConquered);

  // Berikan Hadiah Koin & Tiket ke gachaStats
  gStats.coins = (gStats.coins || 0) + realm.rewards.coins;
  gStats.tickets = (gStats.tickets || 0) + realm.rewards.tickets;
  await redis.set(gachaStatsKey(userId), JSON.stringify(gStats));

  // Update profil user: Gelar baru & Isekai Rank agar langsung terlihat di Profile & Publik!
  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const uData = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    if (realm.rewards.title) {
      uData.title = realm.rewards.title;
    }
    uData.isekaiRank = rankInfo.rank;
    uData.unlockedTitles = uData.unlockedTitles || [];
    if (realm.rewards.title && !uData.unlockedTitles.includes(realm.rewards.title)) {
      uData.unlockedTitles.push(realm.rewards.title);
    }
    if (!uData.unlockedTitles.includes(rankInfo.rank)) {
      uData.unlockedTitles.push(rankInfo.rank);
    }
    await redis.set(uKey, JSON.stringify(uData));
  }

  await redis.set(pKey, JSON.stringify(passport));

  return {
    success: true,
    realm,
    guardian,
    combatRounds,
    damageDealt: finalDamage,
    guardianHp: guardian.hp,
    victory: true,
    stamp: {
      id: realm.stampId,
      title: realm.stampTitle,
      conqueredAt: now
    },
    buff: realm.buff,
    rewards: realm.rewards,
    newTitle: realm.rewards.title || rankInfo.rank,
    passport: {
      totalConquered: newTotalConquered,
      ...rankInfo
    }
  };
}
