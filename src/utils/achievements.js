// ===== SISTEM ACHIEVEMENT / BADGE =====
// Semua badge dihitung dari data yang SUDAH ada (user, history, chats),
// jadi tidak perlu field baru di Redis atau endpoint API baru.
// Badge otomatis "unlock" begitu metric-nya terpenuhi.

export const TIERS = {
  bronze: {
    label: 'Bronze',
    text: 'text-[#cd8b5c]',
    ring: 'border-[#cd8b5c]/40',
    bg: 'bg-[#cd8b5c]/10',
    glow: 'shadow-[0_0_20px_-4px_rgba(205,139,92,0.5)]',
    grad: 'from-[#cd8b5c] to-[#a8703f]'
  },
  silver: {
    label: 'Silver',
    text: 'text-[#c8ccd4]',
    ring: 'border-[#c8ccd4]/40',
    bg: 'bg-[#c8ccd4]/10',
    glow: 'shadow-[0_0_20px_-4px_rgba(200,204,212,0.5)]',
    grad: 'from-[#e2e5ea] to-[#9aa0ab]'
  },
  gold: {
    label: 'Gold',
    text: 'text-[#d4a73c]',
    ring: 'border-[#d4a73c]/40',
    bg: 'bg-[#d4a73c]/10',
    glow: 'shadow-[0_0_20px_-4px_rgba(246,207,128,0.6)]',
    grad: 'from-[#d4a73c] to-[#e0a83f]'
  },
  platinum: {
    label: 'Platinum',
    text: 'text-[#b9a4f8]',
    ring: 'border-[#b9a4f8]/40',
    bg: 'bg-[#b9a4f8]/10',
    glow: 'shadow-[0_0_24px_-4px_rgba(185,164,248,0.6)]',
    grad: 'from-[#d8c8ff] to-[#8b6ef0]'
  }
};

// icon = nama komponen dari lucide-react (di-resolve di Achievements.jsx)
export const ACHIEVEMENTS = [
  // ===== ONBOARDING =====
  {
    id: 'first_step',
    name: 'Langkah Pertama',
    desc: 'Tonton anime atau baca komik pertamamu',
    icon: 'Footprints',
    tier: 'bronze',
    category: 'Onboarding',
    target: 1,
    metric: 'historyCount'
  },
  {
    id: 'first_chat',
    name: 'Say Hi!',
    desc: 'Kirim pesan pertama di chat global',
    icon: 'MessageCircle',
    tier: 'bronze',
    category: 'Onboarding',
    target: 1,
    metric: 'chatCount'
  },

  // ===== WATCH TIME =====
  {
    id: 'watch_1h',
    name: 'Pemanasan',
    desc: 'Total waktu nonton 1 jam',
    icon: 'Clock',
    tier: 'bronze',
    category: 'Nonton',
    target: 3600,
    metric: 'watchTime',
    format: 'time'
  },
  {
    id: 'watch_10h',
    name: 'Marathon Runner',
    desc: 'Total waktu nonton 10 jam',
    icon: 'Flame',
    tier: 'silver',
    category: 'Nonton',
    target: 36000,
    metric: 'watchTime',
    format: 'time'
  },
  {
    id: 'watch_50h',
    name: 'Binge Master',
    desc: 'Total waktu nonton 50 jam',
    icon: 'Trophy',
    tier: 'gold',
    category: 'Nonton',
    target: 180000,
    metric: 'watchTime',
    format: 'time'
  },
  {
    id: 'watch_100h',
    name: 'Anime Addict',
    desc: 'Total waktu nonton 100 jam',
    icon: 'Crown',
    tier: 'platinum',
    category: 'Nonton',
    target: 360000,
    metric: 'watchTime',
    format: 'time'
  },

  // ===== LEVEL =====
  {
    id: 'level_5',
    name: 'Naik Kelas',
    desc: 'Mencapai Level 5',
    icon: 'Star',
    tier: 'bronze',
    category: 'Level',
    target: 5,
    metric: 'level'
  },
  {
    id: 'level_10',
    name: 'Anime Lover',
    desc: 'Mencapai Level 10',
    icon: 'Sparkles',
    tier: 'silver',
    category: 'Level',
    target: 10,
    metric: 'level'
  },
  {
    id: 'level_25',
    name: 'Anime Master',
    desc: 'Mencapai Level 25',
    icon: 'Medal',
    tier: 'gold',
    category: 'Level',
    target: 25,
    metric: 'level'
  },
  {
    id: 'level_50',
    name: 'Anime Legend',
    desc: 'Mencapai Level 50',
    icon: 'Gem',
    tier: 'platinum',
    category: 'Level',
    target: 50,
    metric: 'level'
  },

  // ===== KOLEKSI TONTONAN =====
  {
    id: 'collector_5',
    name: 'Kolektor Pemula',
    desc: 'Punya riwayat 5 judul berbeda',
    icon: 'Library',
    tier: 'bronze',
    category: 'Koleksi',
    target: 5,
    metric: 'historyCount'
  },
  {
    id: 'collector_15',
    name: 'Kolektor Handal',
    desc: 'Punya riwayat 15 judul berbeda',
    icon: 'Library',
    tier: 'silver',
    category: 'Koleksi',
    target: 15,
    metric: 'historyCount'
  },
  {
    id: 'collector_30',
    name: 'Kolektor Sejati',
    desc: 'Punya riwayat 30 judul berbeda',
    icon: 'Library',
    tier: 'gold',
    category: 'Koleksi',
    target: 30,
    metric: 'historyCount'
  },

  // ===== KOMIK =====
  {
    id: 'reader_1',
    name: 'Pembaca Baru',
    desc: 'Baca komik pertamamu',
    icon: 'BookOpen',
    tier: 'bronze',
    category: 'Komik',
    target: 1,
    metric: 'mangaCount'
  },
  {
    id: 'reader_10',
    name: 'Kutu Buku',
    desc: 'Baca 10 judul komik berbeda',
    icon: 'BookOpen',
    tier: 'silver',
    category: 'Komik',
    target: 10,
    metric: 'mangaCount'
  },

  // ===== GENRE EXPLORER =====
  {
    id: 'genre_5',
    name: 'Genre Explorer',
    desc: 'Tonton/baca dari 5 genre berbeda',
    icon: 'Compass',
    tier: 'bronze',
    category: 'Eksplorasi',
    target: 5,
    metric: 'genreCount'
  },
  {
    id: 'genre_10',
    name: 'Genre Master',
    desc: 'Tonton/baca dari 10 genre berbeda',
    icon: 'Compass',
    tier: 'gold',
    category: 'Eksplorasi',
    target: 10,
    metric: 'genreCount'
  },

  // ===== SOSIAL / CHAT =====
  {
    id: 'chat_25',
    name: 'Chatty',
    desc: 'Kirim 25 pesan di chat global',
    icon: 'MessagesSquare',
    tier: 'silver',
    category: 'Sosial',
    target: 25,
    metric: 'chatCount'
  },
  {
    id: 'chat_100',
    name: 'Social Butterfly',
    desc: 'Kirim 100 pesan di chat global',
    icon: 'Users',
    tier: 'gold',
    category: 'Sosial',
    target: 100,
    metric: 'chatCount'
  },

  // ===== DAILY STREAK =====
  {
    id: 'streak_3',
    name: 'Konsisten',
    desc: 'Login 3 hari berturut-turut',
    icon: 'Flame',
    tier: 'bronze',
    category: 'Streak',
    target: 3,
    metric: 'streakLongest'
  },
  {
    id: 'streak_7',
    name: 'Seminggu Penuh',
    desc: 'Login 7 hari berturut-turut',
    icon: 'Flame',
    tier: 'silver',
    category: 'Streak',
    target: 7,
    metric: 'streakLongest'
  },
  {
    id: 'streak_30',
    name: 'Sebulan Setia',
    desc: 'Login 30 hari berturut-turut',
    icon: 'Flame',
    tier: 'gold',
    category: 'Streak',
    target: 30,
    metric: 'streakLongest'
  },
  {
    id: 'streak_100',
    name: 'Streak Legend',
    desc: 'Login 100 hari berturut-turut',
    icon: 'Flame',
    tier: 'platinum',
    category: 'Streak',
    target: 100,
    metric: 'streakLongest'
  },

  // ===== TRIVIA ANIME =====
  {
    id: 'trivia_10',
    name: 'Trivia Rookie',
    desc: 'Jawab 10 soal trivia dengan benar',
    icon: 'HelpCircle',
    tier: 'bronze',
    category: 'Trivia',
    target: 10,
    metric: 'triviaCorrect'
  },
  {
    id: 'trivia_50',
    name: 'Trivia Pro',
    desc: 'Jawab 50 soal trivia dengan benar',
    icon: 'HelpCircle',
    tier: 'silver',
    category: 'Trivia',
    target: 50,
    metric: 'triviaCorrect'
  },
  {
    id: 'trivia_150',
    name: 'Trivia Grandmaster',
    desc: 'Jawab 150 soal trivia dengan benar',
    icon: 'HelpCircle',
    tier: 'gold',
    category: 'Trivia',
    target: 150,
    metric: 'triviaCorrect'
  },

  // ===== LOYALTY (umur akun) =====
  {
    id: 'member_7',
    name: 'Member Baru',
    desc: 'Bergabung 7 hari yang lalu',
    icon: 'Calendar',
    tier: 'bronze',
    category: 'Loyalitas',
    target: 7,
    metric: 'accountAgeDays'
  },
  {
    id: 'member_30',
    name: 'Member Setia',
    desc: 'Bergabung 30 hari yang lalu',
    icon: 'CalendarCheck',
    tier: 'silver',
    category: 'Loyalitas',
    target: 30,
    metric: 'accountAgeDays'
  },
  {
    id: 'member_180',
    name: 'Member Lama',
    desc: 'Bergabung 6 bulan yang lalu',
    icon: 'CalendarHeart',
    tier: 'gold',
    category: 'Loyalitas',
    target: 180,
    metric: 'accountAgeDays'
  },
  {
    id: 'member_365',
    name: 'OG Member',
    desc: 'Bergabung 1 tahun yang lalu',
    icon: 'Award',
    tier: 'platinum',
    category: 'Loyalitas',
    target: 365,
    metric: 'accountAgeDays'
  }
];

// Hitung semua metric mentah dari data user/history/chats/streak/trivia yang sudah di-fetch
// `streak` opsional: { count, longest } dari GET /api/v1/user/streak
// `triviaTotalCorrect` opsional: total jawaban benar sepanjang waktu dari GET /api/v1/trivia/today
export function computeAchievementStats(user, history = [], chats = [], streak = null, triviaTotalCorrect = 0) {
  const watchTime = user?.watchTime || 0;
  const level = user?.level || 0;

  const historyCount = history.length;
  const mangaCount = history.filter((h) => h.type === 'manga').length;

  const genreSet = new Set();
  history.forEach((item) => {
    if (!item.genre) return;
    item.genre
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => genreSet.add(g.toLowerCase()));
  });

  const chatCount = chats.length;

  let accountAgeDays = 0;
  if (user?.createdAt) {
    const created = new Date(user.createdAt).getTime();
    if (!Number.isNaN(created)) {
      accountAgeDays = Math.max(0, Math.floor((Date.now() - created) / 86400000));
    }
  }

  return {
    watchTime,
    level,
    historyCount,
    mangaCount,
    genreCount: genreSet.size,
    chatCount,
    accountAgeDays,
    streakLongest: streak?.longest || 0,
    triviaCorrect: triviaTotalCorrect || 0
  };
}

// Gabungkan definisi badge + stats -> daftar badge dengan status unlocked & progress
export function getAchievementProgress(stats) {
  return ACHIEVEMENTS.map((badge) => {
    const current = stats[badge.metric] || 0;
    const unlocked = current >= badge.target;
    const progress = Math.min(100, Math.round((current / badge.target) * 100));
    return { ...badge, current, unlocked, progress };
  });
}

export function formatMetricValue(value, format) {
  if (format === 'time') {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
  }
  return value;
}
