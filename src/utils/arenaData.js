/**
 * Sistem Data & Simulasi Pertarungan Gacha Card Auto-Battle Arena
 * 100% Menggunakan Lucide Icon Names (Bebas Emoji)
 */

import { getCardById, calculateCardCP } from './cardsData.js';

// Matriks Keunggulan Elemen (Attacker Element -> Defender Element = 1.35x damage)
export const ELEMENT_ADVANTAGES = {
  Flame: ['Wind', 'Steel', 'Beast'],
  Wind: ['Earth', 'Sound'],
  Earth: ['Water', 'Lightning', 'Poison'],
  Water: ['Flame'],
  Lightning: ['Water', 'Steel'],
  Light: ['Dark', 'Shadow', 'Blood', 'Poison'],
  Dark: ['Light', 'Holy', 'Mind'],
  Shadow: ['Light', 'Mind'],
  Holy: ['Dark', 'Blood', 'Poison', 'Chaos'],
  Blood: ['Earth', 'Beast'],
  Void: ['Chaos', 'Arcane', 'Mind', 'Secret'],
  Chaos: ['Void', 'Holy', 'Steel'],
  Arcane: ['Void', 'Chaos', 'Wind'],
  Poison: ['Earth', 'Water', 'Beast'],
  Steel: ['Earth', 'Wind', 'Poison'],
  Sound: ['Mind', 'Secret'],
  Mind: ['Sound', 'Chaos'],
  Beast: ['Earth', 'Water'],
  Secret: ['Mind', 'Arcane'],
  Luck: ['Void', 'Chaos', 'Dark', 'Light']
};

export const getElementMultiplier = (attackerElem, defenderElem) => {
  if (!attackerElem || !defenderElem) return 1.0;
  const advantages = ELEMENT_ADVANTAGES[attackerElem] || [];
  if (advantages.includes(defenderElem)) return 1.35;
  const disadvantages = ELEMENT_ADVANTAGES[defenderElem] || [];
  if (disadvantages.includes(attackerElem)) return 0.75;
  return 1.0;
};

// Rank PVP Tiers & Point Thresholds
export const ARENA_RANKS = [
  {
    tier: 'Bronze',
    minRp: 0,
    maxRp: 999,
    badgeColor: 'text-amber-600',
    bgColor: 'bg-amber-600/15',
    borderColor: 'border-amber-600/30',
    iconName: 'Shield',
    dailyRewardCoins: 100,
    dailyRewardTickets: 0
  },
  {
    tier: 'Silver',
    minRp: 1000,
    maxRp: 1999,
    badgeColor: 'text-slate-300',
    bgColor: 'bg-slate-300/15',
    borderColor: 'border-slate-300/30',
    iconName: 'ShieldCheck',
    dailyRewardCoins: 200,
    dailyRewardTickets: 1
  },
  {
    tier: 'Gold',
    minRp: 2000,
    maxRp: 2999,
    badgeColor: 'text-amber-400',
    bgColor: 'bg-amber-400/15',
    borderColor: 'border-amber-400/40',
    iconName: 'Award',
    dailyRewardCoins: 350,
    dailyRewardTickets: 2
  },
  {
    tier: 'Platinum',
    minRp: 3000,
    maxRp: 3999,
    badgeColor: 'text-cyan-400',
    bgColor: 'bg-cyan-400/15',
    borderColor: 'border-cyan-400/40',
    iconName: 'Sparkles',
    dailyRewardCoins: 500,
    dailyRewardTickets: 3
  },
  {
    tier: 'Diamond',
    minRp: 4000,
    maxRp: 4999,
    badgeColor: 'text-purple-400',
    bgColor: 'bg-purple-400/15',
    borderColor: 'border-purple-400/40',
    iconName: 'Zap',
    dailyRewardCoins: 750,
    dailyRewardTickets: 5
  },
  {
    tier: 'Grandmaster Champion',
    minRp: 5000,
    maxRp: 999999,
    badgeColor: 'text-rose-400',
    bgColor: 'bg-rose-400/20',
    borderColor: 'border-rose-400/50',
    iconName: 'Crown',
    dailyRewardCoins: 1000,
    dailyRewardTickets: 10
  }
];

export const getArenaRank = (rp = 1000) => {
  return (
    ARENA_RANKS.find((r) => rp >= r.minRp && rp <= r.maxRp) ||
    ARENA_RANKS[ARENA_RANKS.length - 1]
  );
};

// 50 Lantai PVE Tower of Eternity Bosses
export const PVE_TOWER_FLOORS = Array.from({ length: 50 }, (_, i) => {
  const floor = i + 1;
  const baseHp = Math.floor(12000 + floor * 2600 + Math.pow(floor, 1.35) * 450);
  const baseAtk = Math.floor(2200 + floor * 380 + Math.pow(floor, 1.22) * 90);
  const baseDef = Math.floor(1800 + floor * 280 + Math.pow(floor, 1.18) * 70);

  let bossName = `Cursed Spirit Grade ${Math.max(1, 5 - Math.floor(floor / 10))}`;
  let bossTitle = `Floor Guardian Lv.${floor}`;
  let bossAnime = 'Jujutsu Kaisen';
  let bossElement = ['Flame', 'Shadow', 'Dark', 'Void', 'Chaos', 'Blood', 'Lightning'][floor % 7];
  let bossSkill = 'Dark Surge Wave';
  let bossQuote = 'Kekuatan kegelapan lantai ini tak akan membiarkanmu lewat!';
  let bossCover = 'https://s4.anilist.co/file/anilistcdn/character/large/b113415-LHBAeoZDIsnF.jpg';

  if (floor === 5) {
    bossName = 'Dagon (Cursed Womb)';
    bossTitle = 'Disaster Curse of the Sea';
    bossElement = 'Water';
    bossSkill = 'Disaster Tides & Horizon of the Captivating Skandha';
    bossQuote = 'Jangan remehkan kutukan yang lahir dari ketakutan manusia!';
  } else if (floor === 10) {
    bossName = 'Hanami';
    bossTitle = 'Disaster Curse of Nature';
    bossElement = 'Earth';
    bossSkill = 'Roots of Calamity & Solar Beam';
    bossQuote = 'Hutan dan bumi ini menolak keberadaan kalian!';
  } else if (floor === 15) {
    bossName = 'Jogo';
    bossTitle = 'Disaster Curse of Fire';
    bossElement = 'Flame';
    bossSkill = 'Coffin of the Iron Mountain & Meteor Storm';
    bossQuote = 'Abu kalian bahkan tidak akan tersisa di hadapan api kawahku!';
  } else if (floor === 20) {
    bossName = 'Mahito';
    bossTitle = 'Idle Transfiguration Curse';
    bossElement = 'Chaos';
    bossSkill = 'Self-Embodiment of Perfection';
    bossQuote = 'Jiwa kalian sungguh rapuh dan mudah untuk kubentuk ulang!';
  } else if (floor === 25) {
    bossName = 'Igris the Bloodred';
    bossTitle = 'Shadow Monarch Commander';
    bossElement = 'Blood';
    bossSkill = 'Bloodstorm Greatsword Cleave';
    bossQuote = 'Pedangku akan menguji apakah kau pantas berdiri di hadapan Penguasa Bayangan!';
  } else if (floor === 30) {
    bossName = 'Beru the Ant King';
    bossTitle = 'Predator of the Shadows';
    bossElement = 'Poison';
    bossSkill = 'Supersonic Claws & Sovereign Scream';
    bossQuote = 'KEEEEK! Siapa pun yang menantang Rajaku harus musnah!';
  } else if (floor === 35) {
    bossName = 'Aizen Sousuke (Hogyoku Fusion)';
    bossTitle = 'God of the False Throne';
    bossElement = 'Arcane';
    bossSkill = 'Kyoka Suigetsu: Complete Hypnosis & Fragor';
    bossQuote = 'Sejak awal, tidak ada seorang pun yang berdiri di atas langit!';
  } else if (floor === 40) {
    bossName = 'Kibutsuji Muzan';
    bossTitle = 'Progenitor Demon King';
    bossElement = 'Dark';
    bossSkill = 'Biokinesis Whirlwind & Blood Demon Whip';
    bossQuote = 'Aku adalah makhluk yang paling dekat dengan kesempurnaan abadi!';
  } else if (floor === 45) {
    bossName = 'Kaido of the Beasts';
    bossTitle = 'Strongest Creature on Earth';
    bossElement = 'Lightning';
    bossSkill = 'Bolo Breath & Thunder Bagua Ragnaraku';
    bossQuote = 'WORORORO! Hanya mereka yang memiliki Haki Raja yang bisa bertahan!';
  } else if (floor === 50) {
    bossName = 'Ryomen Sukuna (20 Fingers Reincarnated)';
    bossTitle = 'King of Curses & Calamity God';
    bossElement = 'Void';
    bossSkill = 'Malevolent Shrine (Fukuma Mizushi) & World Cutting Slash';
    bossQuote = 'Berbanggalah kalian yang telah sampai sejauh ini. Kalian kuat, tapi ini adalah panggungku!';
  }

  // Rewards calculation
  const coinsReward = 150 + floor * 40 + (floor % 5 === 0 ? 300 : 0);
  const expReward = 100 + floor * 30 + (floor % 10 === 0 ? 500 : 0);
  const ticketsReward = floor % 10 === 0 ? 3 : floor % 5 === 0 ? 1 : 0;

  return {
    floor,
    name: bossName,
    title: bossTitle,
    anime: bossAnime,
    element: bossElement,
    hp: baseHp,
    atk: baseAtk,
    def: baseDef,
    skill: bossSkill,
    quote: bossQuote,
    cover: bossCover,
    rewards: {
      coins: coinsReward,
      exp: expReward,
      tickets: ticketsReward
    }
  };
});

/**
 * Simulasi Auto-Battle Engine (Turn-Based Synchronized Deterministic)
 * Tim 1 (Player Deck) vs Tim 2 (Opponent / PVE Boss Deck)
 */
export const simulateCardBattle = (team1Cards, team2Cards, isPve = false) => {
  // Bangun Stats Tim 1 (Player)
  let t1TotalHp = 0;
  let t1TotalAtk = 0;
  let t1TotalDef = 0;
  const t1Elements = [];

  team1Cards.forEach((c) => {
    const stars = c.stars || 1;
    const starMult = 1 + (stars - 1) * 0.25;
    t1TotalHp += Math.floor((c.hp || 10000) * starMult);
    t1TotalAtk += Math.floor((c.atk || 5000) * starMult);
    t1TotalDef += Math.floor((c.def || 4000) * starMult);
    if (c.element) t1Elements.push(c.element);
  });

  // Sinergi Elemen Tim 1
  let t1SynergyText = '';
  if (t1Elements.length === 3 && t1Elements[0] === t1Elements[1] && t1Elements[1] === t1Elements[2]) {
    t1TotalAtk = Math.floor(t1TotalAtk * 1.25);
    t1SynergyText = `Elemental Mastery (${t1Elements[0]} +25% ATK)`;
  } else if (new Set(t1Elements).size === 3) {
    t1TotalDef = Math.floor(t1TotalDef * 1.15);
    t1TotalHp = Math.floor(t1TotalHp * 1.15);
    t1SynergyText = 'Rainbow Trinity (+15% DEF & HP)';
  }

  // Bangun Stats Tim 2
  let t2TotalHp = 0;
  let t2TotalAtk = 0;
  let t2TotalDef = 0;
  const t2Elements = [];

  team2Cards.forEach((c) => {
    const stars = c.stars || 1;
    const starMult = isPve ? 1.0 : 1 + (stars - 1) * 0.25;
    t2TotalHp += Math.floor((c.hp || 10000) * starMult);
    t2TotalAtk += Math.floor((c.atk || 5000) * starMult);
    t2TotalDef += Math.floor((c.def || 4000) * starMult);
    if (c.element) t2Elements.push(c.element);
  });

  let t2SynergyText = '';
  if (t2Elements.length === 3 && t2Elements[0] === t2Elements[1] && t2Elements[1] === t2Elements[2]) {
    t2TotalAtk = Math.floor(t2TotalAtk * 1.25);
    t2SynergyText = `Elemental Mastery (${t2Elements[0]} +25% ATK)`;
  } else if (new Set(t2Elements).size === 3) {
    t2TotalDef = Math.floor(t2TotalDef * 1.15);
    t2TotalHp = Math.floor(t2TotalHp * 1.15);
    t2SynergyText = 'Rainbow Trinity (+15% DEF & HP)';
  }

  const initialT1Hp = t1TotalHp;
  const initialT2Hp = t2TotalHp;

  let curT1Hp = t1TotalHp;
  let curT2Hp = t2TotalHp;

  const combatLog = [];
  const maxRounds = 18;
  let round = 0;

  while (curT1Hp > 0 && curT2Hp > 0 && round < maxRounds) {
    round++;

    // Turn Player (Tim 1 menyerang Tim 2)
    const pCard = team1Cards[(round - 1) % team1Cards.length];
    const defCard2 = team2Cards[(round - 1) % team2Cards.length];
    const pElemMult = getElementMultiplier(pCard.element, defCard2?.element);

    // Roll Crit (15% chance)
    const isCrit = Math.random() < 0.18;
    const critMult = isCrit ? 1.6 : 1.0;

    // Ultimate skill trigger on round 3, 6, 9
    const isUlt1 = round % 3 === 0;
    const ultMult1 = isUlt1 ? 1.75 : 1.0;

    // Damage Formula
    const rawDmg1 = Math.max(800, Math.floor((t1TotalAtk * 0.38 - t2TotalDef * 0.12) * pElemMult * critMult * ultMult1));
    // Variance +/- 8%
    const finalDmg1 = Math.floor(rawDmg1 * (0.92 + Math.random() * 0.16));

    curT2Hp = Math.max(0, curT2Hp - finalDmg1);

    combatLog.push({
      round,
      turn: 'player',
      attackerName: pCard.name,
      attackerRarity: pCard.rarity,
      attackerElement: pCard.element,
      defenderName: defCard2?.name || 'Musuh',
      damage: finalDmg1,
      isCrit,
      isUlt: isUlt1,
      ultSkill: pCard.quote || `${pCard.name} Ultimate Burst!`,
      elemMult: pElemMult,
      t1Hp: curT1Hp,
      t2Hp: curT2Hp,
      t1HpPercent: Math.round((curT1Hp / initialT1Hp) * 100),
      t2HpPercent: Math.round((curT2Hp / initialT2Hp) * 100)
    });

    if (curT2Hp <= 0) break;

    // Turn Opponent (Tim 2 menyerang Tim 1)
    const oCard = team2Cards[(round - 1) % team2Cards.length];
    const oElemMult = getElementMultiplier(oCard.element, pCard.element);

    const isCrit2 = Math.random() < 0.14;
    const critMult2 = isCrit2 ? 1.5 : 1.0;

    const isUlt2 = round % 3 === 0;
    const ultMult2 = isUlt2 ? 1.65 : 1.0;

    const rawDmg2 = Math.max(600, Math.floor((t2TotalAtk * 0.36 - t1TotalDef * 0.14) * oElemMult * critMult2 * ultMult2));
    const finalDmg2 = Math.floor(rawDmg2 * (0.92 + Math.random() * 0.16));

    curT1Hp = Math.max(0, curT1Hp - finalDmg2);

    combatLog.push({
      round,
      turn: 'opponent',
      attackerName: oCard.name,
      attackerRarity: oCard.rarity || 'BOSS',
      attackerElement: oCard.element,
      defenderName: pCard.name,
      damage: finalDmg2,
      isCrit: isCrit2,
      isUlt: isUlt2,
      ultSkill: oCard.skill || oCard.quote || `${oCard.name} Devastating Strike!`,
      elemMult: oElemMult,
      t1Hp: curT1Hp,
      t2Hp: curT2Hp,
      t1HpPercent: Math.round((curT1Hp / initialT1Hp) * 100),
      t2HpPercent: Math.round((curT2Hp / initialT2Hp) * 100)
    });
  }

  const victory = curT1Hp > 0 && curT2Hp <= 0;

  return {
    victory,
    totalRounds: round,
    team1: {
      initialHp: initialT1Hp,
      remainingHp: curT1Hp,
      atk: t1TotalAtk,
      def: t1TotalDef,
      synergy: t1SynergyText
    },
    team2: {
      initialHp: initialT2Hp,
      remainingHp: curT2Hp,
      atk: t2TotalAtk,
      def: t2TotalDef,
      synergy: t2SynergyText
    },
    combatLog
  };
};
