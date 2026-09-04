import { getCardById } from '../../src/utils/cardsData.js';
import { gachaStatsKey, userCardsKey, userDeckKey } from './cards.js';

// Format tanggal WIB
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

// Bot Gladiator untuk melengkapi kuota 16 peserta jika belum penuh saat turnamen dimulai
const BOT_GLADIATORS = [
  { name: 'Kage Shura', title: 'Ninja Rogue', avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=200&auto=format&fit=crop&q=80', level: 12, basePower: 8500 },
  { name: 'Valkyrie Freya', title: 'Paladin of Light', avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80', level: 14, basePower: 9200 },
  { name: 'Crimson Akuma', title: 'Demon Hunter', avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80', level: 13, basePower: 8800 },
  { name: 'Zenith Archer', title: 'Wind Strider', avatar: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80', level: 11, basePower: 8100 },
  { name: 'Abyssal Warlock', title: 'Void Caller', avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=200&auto=format&fit=crop&q=80', level: 15, basePower: 9600 },
  { name: 'Ragnar Ironfist', title: 'Berserker King', avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80', level: 14, basePower: 9400 },
  { name: 'Seraphina Frost', title: 'Ice Sovereign', avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80', level: 12, basePower: 8600 },
  { name: 'Sol Invictus', title: 'Solar Champion', avatar: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80', level: 16, basePower: 10200 },
  { name: 'Cyber Phantom', title: 'Netrunner X', avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=200&auto=format&fit=crop&q=80', level: 13, basePower: 8900 },
  { name: 'Grand Master Jin', title: 'Way of the Fist', avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80', level: 15, basePower: 9800 },
  { name: 'Morganna Dark', title: 'Shadow Empress', avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80', level: 16, basePower: 10500 },
  { name: 'Astraea Dawn', title: 'Starlight Oracle', avatar: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80', level: 14, basePower: 9300 },
  { name: 'Gargantua Coloss', title: 'Titan Vanguard', avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=200&auto=format&fit=crop&q=80', level: 17, basePower: 11000 },
  { name: 'Kusanagi Blade', title: 'Sword Saint', avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80', level: 18, basePower: 11500 },
  { name: 'Void Archon', title: 'Dimension Sovereign', avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80', level: 19, basePower: 12200 }
];

export const tournamentKey = (season) => `colosseum:tournament:${season}`;
export const championHistoryKey = () => 'colosseum:champion_history';

// Ambil info user
async function getUserBrief(redis, userId) {
  const raw = await redis.get(`user:${userId}`);
  if (!raw) return { id: userId, name: 'Petualang', picture: null, level: 1, title: 'Gladiator' };
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    id: userId,
    name: u.name || 'Petualang',
    picture: u.picture || null,
    level: u.level || 1,
    title: u.title || 'Gladiator'
  };
}

// Inisialisasi Turnamen Musim Ini
export async function getOrInitTournament(redis) {
  const season = isoWeekStr();
  const raw = await redis.get(tournamentKey(season));
  let tData = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;

  if (!tData) {
    tData = {
      seasonWeek: season,
      status: 'REGISTRATION', // 'REGISTRATION' | 'IN_PROGRESS' | 'FINISHED'
      maxParticipants: 16,
      participants: [],
      bracket: {
        r16: [], // 8 Matches (Match 1 - 8)
        qf: [],  // 4 Matches (Match 9 - 12)
        sf: [],  // 2 Matches (Match 13 - 14)
        final: null // 1 Match (Match 15)
      },
      champion: null,
      runnerUp: null,
      startedAt: null,
      completedAt: null,
      replays: {} // matchId -> detailed combat log
    };
    await redis.set(tournamentKey(season), JSON.stringify(tData));
  }

  return tData;
}

// Simulasi Duel Match 3-Ronde antara Dua Partisipan
function simulateMatch(p1, p2, matchId, roundLabel) {
  let p1TotalDamage = 0;
  let p2TotalDamage = 0;
  const combatRounds = [];

  const p1Power = p1.totalPower || (p1.level * 600 + 4000);
  const p2Power = p2.totalPower || (p2.level * 600 + 4000);

  for (let r = 1; r <= 3; r++) {
    // Variasi acak +- 20% & crit chance 25%
    const p1Crit = Math.random() < 0.25;
    const p2Crit = Math.random() < 0.25;

    const p1Dmg = Math.round((p1Power / 3) * (0.85 + Math.random() * 0.3) * (p1Crit ? 1.6 : 1.0));
    const p2Dmg = Math.round((p2Power / 3) * (0.85 + Math.random() * 0.3) * (p2Crit ? 1.6 : 1.0));

    p1TotalDamage += p1Dmg;
    p2TotalDamage += p2Dmg;

    combatRounds.push({
      round: r,
      p1Card: p1.deck?.[r - 1]?.name || `${p1.name}'s Strike`,
      p1Damage: p1Dmg,
      p1Crit,
      p2Card: p2.deck?.[r - 1]?.name || `${p2.name}'s Strike`,
      p2Damage: p2Dmg,
      p2Crit
    });
  }

  // Tentukan pemenang
  const winner = p1TotalDamage >= p2TotalDamage ? p1 : p2;
  const loser = winner.id === p1.id ? p2 : p1;

  const matchData = {
    matchId,
    roundLabel,
    p1: { id: p1.id, name: p1.name, avatar: p1.avatar, score: p1TotalDamage, level: p1.level, title: p1.title },
    p2: { id: p2.id, name: p2.name, avatar: p2.avatar, score: p2TotalDamage, level: p2.level, title: p2.title },
    winnerId: winner.id,
    winnerName: winner.name,
    status: 'COMPLETED'
  };

  const replayData = {
    ...matchData,
    p1Full: p1,
    p2Full: p2,
    combatRounds,
    p1TotalDamage,
    p2TotalDamage
  };

  return { matchData, replayData, winner, loser };
}

// ===== 1. GET TOURNAMENT BRACKET & STATUS =====
export async function getTournamentStatus(redis, userId) {
  const tData = await getOrInitTournament(redis);
  const rawHistory = await redis.lrange(championHistoryKey(), 0, 10);
  const championHistory = (rawHistory || []).map((h) => (typeof h === 'string' ? JSON.parse(h) : h));

  const isUserRegistered = userId
    ? tData.participants.some((p) => p.id === userId)
    : false;

  return {
    success: true,
    tournament: {
      seasonWeek: tData.seasonWeek,
      status: tData.status,
      participantsCount: tData.participants.length,
      maxParticipants: tData.maxParticipants,
      participants: tData.participants.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        level: p.level,
        title: p.title,
        totalPower: p.totalPower,
        isUser: p.id === userId
      })),
      bracket: tData.bracket,
      champion: tData.champion,
      runnerUp: tData.runnerUp,
      completedAt: tData.completedAt
    },
    isUserRegistered,
    championHistory
  };
}

// ===== 2. DAFTARKAN DIRI KE TURNAMEN =====
export async function registerTournament(redis, userId) {
  const tData = await getOrInitTournament(redis);

  if (tData.status !== 'REGISTRATION') {
    return { success: false, error: 'Pendaftaran turnamen musim ini telah ditutup!' };
  }

  if (tData.participants.some((p) => p.id === userId)) {
    return { success: false, error: 'Kamu sudah terdaftar di turnamen ini!' };
  }

  if (tData.participants.length >= tData.maxParticipants) {
    return { success: false, error: 'Kuota 16 peserta turnamen sudah penuh!' };
  }

  const [user, rawDeck, rawCards] = await Promise.all([
    getUserBrief(redis, userId),
    redis.get(userDeckKey(userId)),
    redis.get(userCardsKey(userId))
  ]);

  let deck = [];
  if (rawDeck) {
    try {
      const parsed = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
      if (Array.isArray(parsed) && parsed.length > 0) deck = parsed;
    } catch {}
  }
  if (deck.length === 0 && rawCards) {
    try {
      const parsedCards = typeof rawCards === 'string' ? JSON.parse(rawCards) : rawCards;
      const allCards = Object.values(parsedCards).map((c) => ({
        ...getCardById(c.id),
        ...c
      })).filter(Boolean);
      allCards.sort((a, b) => (b.attack || 500) - (a.attack || 500));
      deck = allCards.slice(0, 3);
    } catch {}
  }

  let totalPower = 0;
  deck.forEach((c) => {
    totalPower += (c.attack || 1000) * (1 + ((c.stars || 1) - 1) * 0.25);
  });
  if (totalPower === 0) totalPower = (user.level || 1) * 800 + 5000;

  const participant = {
    id: userId,
    name: user.name,
    avatar: user.picture,
    level: user.level,
    title: user.title,
    totalPower: Math.round(totalPower),
    deck,
    isBot: false,
    registeredAt: Date.now()
  };

  tData.participants.push(participant);
  await redis.set(tournamentKey(tData.seasonWeek), JSON.stringify(tData));

  // Jika slot langsung mencapai 16 peserta, auto-start turnamen!
  if (tData.participants.length === 16) {
    await simulateFullTournament(redis, tData.seasonWeek);
  }

  return {
    success: true,
    message: 'Berhasil mendaftar ke Bagan Turnamen 16 Besar Colosseum!',
    participant,
    currentCount: tData.participants.length
  };
}

// ===== 3. SIMULASI LENGKAP TURNAMEN BRACKET (16 Besar -> Grand Final) =====
export async function simulateFullTournament(redis, seasonWeek) {
  const season = seasonWeek || isoWeekStr();
  const raw = await redis.get(tournamentKey(season));
  if (!raw) return { success: false, error: 'Data turnamen tidak ditemukan' };

  const tData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (tData.status === 'FINISHED') {
    return { success: true, tournament: tData };
  }

  // Lengkapi dengan Bot Gladiator hingga 16 peserta jika belum genap
  let botIdx = 0;
  while (tData.participants.length < 16 && botIdx < BOT_GLADIATORS.length) {
    const b = BOT_GLADIATORS[botIdx];
    tData.participants.push({
      id: `bot_${botIdx + 1}_${Date.now()}`,
      name: b.name,
      avatar: b.avatar,
      level: b.level,
      title: b.title,
      totalPower: b.basePower,
      deck: [],
      isBot: true,
      registeredAt: Date.now()
    });
    botIdx++;
  }

  tData.status = 'IN_PROGRESS';
  tData.startedAt = nowWIB().toISOString();
  tData.replays = tData.replays || {};

  // Acak posisi peserta
  const shuffled = [...tData.participants].sort(() => Math.random() - 0.5);

  // 1. BABAK 16 BESAR (8 Matches: m1 - m8)
  const r16Matches = [];
  const qfContenders = [];
  for (let i = 0; i < 8; i++) {
    const p1 = shuffled[i * 2];
    const p2 = shuffled[i * 2 + 1];
    const matchId = `match_${i + 1}`;
    const { matchData, replayData, winner } = simulateMatch(p1, p2, matchId, '16 Besar');
    r16Matches.push(matchData);
    tData.replays[matchId] = replayData;
    qfContenders.push(winner);
  }
  tData.bracket.r16 = r16Matches;

  // 2. PEREMPAT FINAL (4 Matches: m9 - m12)
  const qfMatches = [];
  const sfContenders = [];
  for (let i = 0; i < 4; i++) {
    const p1 = qfContenders[i * 2];
    const p2 = qfContenders[i * 2 + 1];
    const matchId = `match_${8 + i + 1}`;
    const { matchData, replayData, winner } = simulateMatch(p1, p2, matchId, 'Perempat Final');
    qfMatches.push(matchData);
    tData.replays[matchId] = replayData;
    sfContenders.push(winner);
  }
  tData.bracket.qf = qfMatches;

  // 3. SEMIFINAL (2 Matches: m13 - m14)
  const sfMatches = [];
  const finalContenders = [];
  for (let i = 0; i < 2; i++) {
    const p1 = sfContenders[i * 2];
    const p2 = sfContenders[i * 2 + 1];
    const matchId = `match_${12 + i + 1}`;
    const { matchData, replayData, winner } = simulateMatch(p1, p2, matchId, 'Semifinal');
    sfMatches.push(matchData);
    tData.replays[matchId] = replayData;
    finalContenders.push(winner);
  }
  tData.bracket.sf = sfMatches;

  // 4. GRAND FINAL (1 Match: m15)
  const finalMatchId = 'match_15';
  const { matchData: finalMatchData, replayData: finalReplayData, winner: champion, loser: runnerUp } = simulateMatch(
    finalContenders[0],
    finalContenders[1],
    finalMatchId,
    'Grand Final'
  );
  tData.bracket.final = finalMatchData;
  tData.replays[finalMatchId] = finalReplayData;

  tData.champion = champion;
  tData.runnerUp = runnerUp;
  tData.status = 'FINISHED';
  tData.completedAt = nowWIB().toISOString();

  // Berikan Hadiah Juara Emas jika pemenang adalah petualang sungguhan (Bukan bot)
  if (!champion.isBot) {
    const gKey = gachaStatsKey(champion.id);
    const rawG = await redis.get(gKey);
    if (rawG) {
      const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
      gStats.coins = (gStats.coins || 0) + 10000;
      gStats.tickets = (gStats.tickets || 0) + 10;
      await redis.set(gKey, JSON.stringify(gStats));
    }

    // Sematkan Gelar Juara & Bingkai Emas Colosseum di profil
    const uKey = `user:${champion.id}`;
    const rawU = await redis.get(uKey);
    if (rawU) {
      const uData = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
      uData.title = 'Colosseum Grand Champion';
      uData.frame = 'frame_gold';
      uData.unlockedTitles = uData.unlockedTitles || [];
      if (!uData.unlockedTitles.includes('Colosseum Grand Champion')) {
        uData.unlockedTitles.push('Colosseum Grand Champion');
      }
      await redis.set(uKey, JSON.stringify(uData));
    }
  }

  // Hadiah Runner-up jika user sungguhan
  if (!runnerUp.isBot) {
    const gKey = gachaStatsKey(runnerUp.id);
    const rawG = await redis.get(gKey);
    if (rawG) {
      const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
      gStats.coins = (gStats.coins || 0) + 5000;
      gStats.tickets = (gStats.tickets || 0) + 5;
      await redis.set(gKey, JSON.stringify(gStats));
    }
  }

  // Simpan riwayat juara turnamen
  const champHistoryEntry = {
    seasonWeek: tData.seasonWeek,
    championId: champion.id,
    championName: champion.name,
    championAvatar: champion.avatar,
    championTitle: champion.title,
    runnerUpName: runnerUp.name,
    completedAt: tData.completedAt
  };

  await Promise.all([
    redis.set(tournamentKey(season), JSON.stringify(tData)),
    redis.lpush(championHistoryKey(), JSON.stringify(champHistoryEntry)),
    redis.ltrim(championHistoryKey(), 0, 20)
  ]);

  return {
    success: true,
    tournament: tData
  };
}

// ===== 4. GET MATCH REPLAY DETAIL =====
export async function getMatchReplay(redis, matchId, seasonWeek) {
  const season = seasonWeek || isoWeekStr();
  const raw = await redis.get(tournamentKey(season));
  if (!raw) return { success: false, error: 'Data turnamen tidak ditemukan' };

  const tData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const replay = tData.replays?.[matchId];

  if (!replay) {
    return { success: false, error: 'Rekaman pertandingan belum tersedia' };
  }

  return {
    success: true,
    matchId,
    replay
  };
}
