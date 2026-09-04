/**
 * Definisi Animated Profile Aura
 * Efek visual aura dinamis di sekeliling avatar profil.
 * 100% Menggunakan Lucide Icon Names (Bebas Emoji)
 */

export const AURAS = [
  {
    id: 'none',
    name: 'Tanpa Aura',
    minLevel: 0,
    iconName: 'Shield',
    accentColor: '#8a8a97',
    description: 'Tampilan avatar normal tanpa efek aura tambahan.',
    containerClass: '',
    effectClass: ''
  },
  {
    id: 'supersaiyan',
    name: 'Super Saiyan Gold',
    minLevel: 10,
    iconName: 'Zap',
    accentColor: '#eab308',
    description: 'Pancaran energi ki emas membara dengan kilatan petir dan percikan api keemasan.',
    containerClass: 'relative',
    effectClass: 'aura-supersaiyan'
  },
  {
    id: 'shadowneon',
    name: 'Shadow Neon Violet',
    minLevel: 25,
    iconName: 'Sparkles',
    accentColor: '#a855f7',
    description: 'Aura cyberpunk ungu gelap dengan pulsa gelombang neon elektrik.',
    containerClass: 'relative',
    effectClass: 'aura-shadowneon'
  },
  {
    id: 'cursedflame',
    name: 'Cursed Crimson Flame',
    minLevel: 45,
    iconName: 'Flame',
    accentColor: '#ef4444',
    description: 'Kobaran energi kutukan merah darah yang ganas ala Ryomen Sukuna.',
    containerClass: 'relative',
    effectClass: 'aura-cursedflame'
  },
  {
    id: 'glacier',
    name: 'Glacier Frost Cyan',
    minLevel: 70,
    iconName: 'Compass',
    accentColor: '#06b6d4',
    description: 'Kabut es kristal membeku dengan kilauan partikel berlian dingin.',
    containerClass: 'relative',
    effectClass: 'aura-glacier'
  },
  {
    id: 'phoenix',
    name: 'Phoenix Solar Flare',
    minLevel: 100,
    iconName: 'Flame',
    accentColor: '#f97316',
    description: 'Gelombang badai api surya burung phoenix abadi.',
    containerClass: 'relative',
    effectClass: 'aura-phoenix'
  },
  {
    id: 'raijin',
    name: 'Raijin Blue Lightning',
    minLevel: 85,
    iconName: 'Zap',
    accentColor: '#38bdf8',
    description: 'Arus petir biru elektrik dewa guntur berputar cepat dengan percikan plasma.',
    containerClass: 'relative',
    effectClass: 'aura-raijin'
  },
  {
    id: 'bloodmoon',
    name: 'Bloodmoon Eclipse',
    minLevel: 120,
    iconName: 'Moon',
    accentColor: '#be123c',
    description: 'Pusaran gerhana bulan darah merah gelap dengan kabut bayangan mistis.',
    containerClass: 'relative',
    effectClass: 'aura-bloodmoon'
  },
  {
    id: 'celestial',
    name: 'Celestial Godly Prismatic',
    minLevel: 150,
    iconName: 'Crown',
    accentColor: '#ec4899',
    description: 'Aura dewa tertinggi dengan spektrum pelangi kromatik yang memukau.',
    containerClass: 'relative',
    effectClass: 'aura-celestial'
  }
];

export const getAuraById = (id) => AURAS.find((a) => a.id === id) || AURAS[0];
