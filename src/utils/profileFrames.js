// Katalog frame avatar — id HARUS sama persis dengan FRAMES di
// api/v1/user/[...action].js (dipakai backend buat validasi unlock).
export const FRAMES = [
  {
    id: 'none',
    name: 'Tanpa Frame',
    minLevel: 0,
    ring: '',
    glow: ''
  },
  {
    id: 'bronze',
    name: 'Bronze Ring',
    minLevel: 5,
    ring: 'ring-4 ring-[#cd8b5c]',
    glow: 'shadow-[0_0_16px_-2px_rgba(205,139,92,0.6)]'
  },
  {
    id: 'silver',
    name: 'Silver Ring',
    minLevel: 15,
    ring: 'ring-4 ring-[#c8ccd4]',
    glow: 'shadow-[0_0_16px_-2px_rgba(200,204,212,0.6)]'
  },
  {
    id: 'gold',
    name: 'Gold Ring',
    minLevel: 30,
    ring: 'ring-4 ring-[#d4a73c]',
    glow: 'shadow-[0_0_18px_-2px_rgba(246,207,128,0.7)]'
  },
  {
    id: 'fire',
    name: 'Api Membara',
    minLevel: 50,
    ring: 'ring-4 ring-orange-500',
    glow: 'shadow-[0_0_22px_-2px_rgba(249,115,22,0.8)] animate-pulse'
  },
  {
    id: 'platinum',
    name: 'Platinum Ring',
    minLevel: 75,
    ring: 'ring-4 ring-[#b9a4f8]',
    glow: 'shadow-[0_0_22px_-2px_rgba(185,164,248,0.8)]'
  },
  {
    id: 'rainbow',
    name: 'Rainbow Legend',
    minLevel: 150,
    // Gradient ring pakai bg + padding trick (bukan `ring-*`) karena butuh multi-warna
    ring: '',
    isGradient: true,
    gradient: 'bg-gradient-to-tr from-pink-500 via-yellow-400 via-green-400 via-blue-500 to-purple-500',
    glow: 'shadow-[0_0_24px_-2px_rgba(168,85,247,0.8)]'
  }
];

export const getFrame = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];

export const getUnlockedFrames = (level = 0) => FRAMES.filter((f) => f.minLevel <= level);
