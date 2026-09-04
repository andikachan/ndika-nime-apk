/**
 * Data Mood & Kurasi Anime untuk Anime Mood Picker & Roulette
 * 100% Menggunakan Lucide Icon Names (Bebas Emoji)
 * Terintegrasi sinkron dengan API streaming pencarian Ndika-Nime
 */

export const MOOD_CATEGORIES = [
  {
    id: 'tearjerker',
    title: 'Butuh Nangis / Bawang',
    subtitle: 'Cerita Emosional & Mengharukan',
    iconName: 'HeartCrack',
    accentColor: '#38bdf8',
    bgGradient: 'from-sky-500/20 to-blue-600/10',
    borderGlow: 'border-sky-500/40',
    description: 'Siapkan tisu! Kisah drama menyentuh hati, perpisahan emosional, dan momen haru yang bikin banjir air mata.',
    curatedAnime: [
      {
        id: 'koe_no_katachi',
        searchQuery: 'Koe no Katachi',
        title: 'Koe no Katachi (A Silent Voice)',
        type: 'Movie',
        score: '9.0',
        genres: 'Drama, Romance',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20954-sYRfE5jQRtSB.jpg',
        quote: 'Menebus masa lalu dan belajar memaafkan diri sendiri.'
      },
      {
        id: 'your_lie_in_april',
        searchQuery: 'Shigatsu wa Kimi no Uso',
        title: 'Shigatsu wa Kimi no Uso (Your Lie in April)',
        type: 'TV (22 Eps)',
        score: '8.8',
        genres: 'Drama, Music, Romance',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20665-TLgkL8T8IRFd.png',
        quote: 'Kisah melodi musik dan musim semi yang tak terlupakan.'
      },
      {
        id: 'violet_evergarden',
        searchQuery: 'Violet Evergarden',
        title: 'Violet Evergarden',
        type: 'TV (13 Eps)',
        score: '8.9',
        genres: 'Drama, Fantasy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21827-ubzq619ZA2E9.png',
        quote: 'Mencari arti dari kata "Aku Mencintaimu".'
      },
      {
        id: 'anohana',
        searchQuery: 'Anohana',
        title: 'Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai (Anohana)',
        type: 'TV (11 Eps)',
        score: '8.5',
        genres: 'Drama, Mystery, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9989-hImMg6kCMm6I.jpg',
        quote: 'Janji masa kecil yang mengikat kembali persahabatan.'
      },
      {
        id: 'kimi_no_suizou',
        searchQuery: 'Kimi no Suizou wo Tabetai',
        title: 'Kimi no Suizou wo Tabetai (I Want to Eat Your Pancreas)',
        type: 'Movie',
        score: '8.7',
        genres: 'Drama, Romance, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx99750-pNyly9d3MEgV.jpg',
        quote: 'Menghargai setiap detik sisa waktu yang berharga.'
      },
      {
        id: 'clannad_after_story',
        searchQuery: 'Clannad',
        title: 'Clannad: After Story',
        type: 'TV (24 Eps)',
        score: '9.1',
        genres: 'Drama, Romance, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx4181-zUKE7BZC62OF.png',
        quote: 'Arti sesungguhnya dari sebuah keluarga dan ketulusan.'
      }
    ]
  },
  {
    id: 'healing',
    title: 'Santai & Healing (Iyashikei)',
    subtitle: 'Menenangkan Jiwa & Melepas Penat',
    iconName: 'Coffee',
    accentColor: '#10b981',
    bgGradient: 'from-emerald-500/20 to-teal-600/10',
    borderGlow: 'border-emerald-500/40',
    description: 'Cocok ditonton setelah seharian lelah! Suasana damai, pemandangan asri, dan kisah hangat yang menyegarkan pikiran.',
    curatedAnime: [
      {
        id: 'frieren',
        searchQuery: 'Frieren',
        title: 'Sousou no Frieren (Frieren: Beyond Journey\'s End)',
        type: 'TV (28 Eps)',
        score: '9.3',
        genres: 'Adventure, Drama, Fantasy',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
        quote: 'Perjalanan memahami manusia setelah petualangan usai.'
      },
      {
        id: 'yuru_camp',
        searchQuery: 'Yuru Camp',
        title: 'Yuru Camp△ (Laid-Back Camp)',
        type: 'TV (12 Eps)',
        score: '8.6',
        genres: 'Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx98444-Vzysp1EsrzgD.jpg',
        quote: 'Hangatnya api unggun dan pemandangan Gunung Fuji.'
      },
      {
        id: 'bocchi_the_rock',
        searchQuery: 'Bocchi the Rock',
        title: 'Bocchi the Rock!',
        type: 'TV (12 Eps)',
        score: '8.8',
        genres: 'Comedy, Music, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-HTDmeL4RGeJ4.png',
        quote: 'Melawan kecemasan sosial lewat dentuman gitar rock.'
      },
      {
        id: 'non_non_biyori',
        searchQuery: 'Non Non Biyori',
        title: 'Non Non Biyori',
        type: 'TV (12 Eps)',
        score: '8.3',
        genres: 'Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx17549-ROdV36u4nWkU.png',
        quote: 'Kedamaian dan canda tawa di pedesaan asri.'
      },
      {
        id: 'barakamon',
        searchQuery: 'Barakamon',
        title: 'Barakamon',
        type: 'TV (12 Eps)',
        score: '8.5',
        genres: 'Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20722-2KAeq72E95dr.png',
        quote: 'Menemukan jati diri seni di pulau yang ramah.'
      },
      {
        id: 'natsume_yuujinchou',
        searchQuery: 'Natsume Yuujinchou',
        title: 'Natsume Yuujinchou',
        type: 'TV (13 Eps)',
        score: '8.7',
        genres: 'Drama, Fantasy, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx4081-xi08naD69tjr.jpg',
        quote: 'Kebaikan hati yang menghubungkan manusia dan roh.'
      }
    ]
  },
  {
    id: 'hype',
    title: 'Hype Adrenalin & Aksi Brutal',
    subtitle: 'Pertarungan Epik & Sakuga Animasi Gila',
    iconName: 'Zap',
    accentColor: '#f59e0b',
    bgGradient: 'from-amber-500/20 to-orange-600/10',
    borderGlow: 'border-amber-500/40',
    description: 'Pacu detak jantungmu ke titik maksimal! Penuh aksi tanpa henti, kekuatan dahsyat, dan pertarungan sakuga spektakuler.',
    curatedAnime: [
      {
        id: 'jujutsu_kaisen',
        searchQuery: 'Jujutsu Kaisen',
        title: 'Jujutsu Kaisen',
        type: 'TV (24 Eps)',
        score: '8.9',
        genres: 'Action, Supernatural, Fantasy',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg',
        quote: 'Kutukan, pertarungan Domain Expansion, dan tekad baja.'
      },
      {
        id: 'kimetsu_no_yaiba',
        searchQuery: 'Kimetsu no Yaiba',
        title: 'Kimetsu no Yaiba (Demon Slayer)',
        type: 'TV (26 Eps)',
        score: '8.8',
        genres: 'Action, Fantasy, Historical',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg',
        quote: 'Nafas pedang air dan bara api melawan iblis kegelapan.'
      },
      {
        id: 'shingeki_no_kyojin',
        searchQuery: 'Shingeki no Kyojin',
        title: 'Shingeki no Kyojin (Attack on Titan)',
        type: 'TV (25 Eps)',
        score: '9.2',
        genres: 'Action, Mystery, Drama',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
        quote: 'Perjuangan kebebasan umat manusia dari cengkeraman Titan.'
      },
      {
        id: 'solo_leveling',
        searchQuery: 'Solo Leveling',
        title: 'Solo Leveling (Ore dake Level Up na Ken)',
        type: 'TV (12 Eps)',
        score: '8.7',
        genres: 'Action, Adventure, Fantasy',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png',
        quote: 'Dari Hunter terlemah menjadi Shadow Monarch penguasa takdir.'
      },
      {
        id: 'chainsaw_man',
        searchQuery: 'Chainsaw Man',
        title: 'Chainsaw Man',
        type: 'TV (12 Eps)',
        score: '8.6',
        genres: 'Action, Gore, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png',
        quote: 'Denji dan gergaji mesin memburu iblis di dunia brutal.'
      },
      {
        id: 'mob_psycho_100',
        searchQuery: 'Mob Psycho 100',
        title: 'Mob Psycho 100',
        type: 'TV (12 Eps)',
        score: '9.1',
        genres: 'Action, Comedy, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21507-6YUSbh2m0N1p.jpg',
        quote: 'Ledakan kekuatan psikis 100% dengan animasi sakuga puncak.'
      }
    ]
  },
  {
    id: 'comedy',
    title: 'Komedi Bikin Ngakak',
    subtitle: 'Lelucon Absurd & Bikin Awet Muda',
    iconName: 'Smile',
    accentColor: '#ec4899',
    bgGradient: 'from-pink-500/20 to-rose-600/10',
    borderGlow: 'border-pink-500/40',
    description: 'Lupakan stres hari ini! Penuh tingkah absurd tak terduga, parodi gila-gilaan, dan candaan yang bikin rahang sakit karena tertawa.',
    curatedAnime: [
      {
        id: 'konosuba',
        searchQuery: 'Konosuba',
        title: 'Kono Subarashii Sekai ni Shukufuku wo! (KonoSuba)',
        type: 'TV (10 Eps)',
        score: '8.6',
        genres: 'Adventure, Comedy, Fantasy',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21202-mPOr80AEjUcZ.png',
        quote: 'Party isekai paling kacau, kocak, dan tidak berguna sedunia.'
      },
      {
        id: 'gintama',
        searchQuery: 'Gintama',
        title: 'Gintama',
        type: 'TV (201 Eps)',
        score: '9.2',
        genres: 'Action, Comedy, Sci-Fi',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx918-iOaeBVUn4uK7.jpg',
        quote: 'Raja parodi anime dengan humor tak berakal dan jiwa samurai.'
      },
      {
        id: 'saiki_kusuo',
        searchQuery: 'Saiki Kusuo',
        title: 'Saiki Kusuo no Ψ-nan (The Disastrous Life of Saiki K.)',
        type: 'TV (120 Eps)',
        score: '8.7',
        genres: 'Comedy, Slice of Life, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21804-As6tDLAvEvNY.jpg',
        quote: 'Punya semua kekuatan super tapi cuma pengen hidup tenang.'
      },
      {
        id: 'grand_blue',
        searchQuery: 'Grand Blue',
        title: 'Grand Blue Dreaming',
        type: 'TV (12 Eps)',
        score: '8.8',
        genres: 'Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx100922-uxEhaCsqMMp3.png',
        quote: 'Katanya klub menyelam, tapi isinya minum dan kekacauan kampus.'
      },
      {
        id: 'spy_x_family',
        searchQuery: 'Spy x Family',
        title: 'Spy x Family',
        type: 'TV (12 Eps)',
        score: '8.6',
        genres: 'Action, Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-Kb6R5nYQfjmP.jpg',
        quote: 'Keluarga palsu: Mata-mata, pembunuh bayaran, dan bocah esper.'
      },
      {
        id: 'danshi_koukousei',
        searchQuery: 'Danshi Koukousei no Nichijou',
        title: 'Danshi Koukousei no Nichijou (Daily Lives of High School Boys)',
        type: 'TV (12 Eps)',
        score: '8.4',
        genres: 'Comedy, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11843-ui2jBcuQUqnl.jpg',
        quote: 'Kelakuan konyol cowok SMA yang relatable dan bikin ngakak.'
      }
    ]
  },
  {
    id: 'mindblown',
    title: 'Plot Twist Otak Meledak',
    subtitle: 'Misteri Mendalam, Thriller & Mind Game',
    iconName: 'Brain',
    accentColor: '#a855f7',
    bgGradient: 'from-purple-500/20 to-indigo-600/10',
    borderGlow: 'border-purple-500/40',
    description: 'Bikin overthinking dan penasaran tiada henti! Adu strategi tingkat tinggi, kebenaran tersembunyi, dan twist tak terduga.',
    curatedAnime: [
      {
        id: 'death_note',
        searchQuery: 'Death Note',
        title: 'Death Note',
        type: 'TV (37 Eps)',
        score: '8.9',
        genres: 'Mystery, Psychological, Supernatural',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg',
        quote: 'Adu kecerdasan legendaris antara Light Yagami dan detektif L.'
      },
      {
        id: 'steins_gate',
        searchQuery: 'Steins;Gate',
        title: 'Steins;Gate',
        type: 'TV (24 Eps)',
        score: '9.2',
        genres: 'Drama, Sci-Fi, Thriller',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg',
        quote: 'Eksperimen microwave waktu yang mengubah takdir dunia.'
      },
      {
        id: 'monster',
        searchQuery: 'Monster',
        title: 'Monster',
        type: 'TV (74 Eps)',
        score: '9.1',
        genres: 'Drama, Mystery, Psychological',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19-gtMC64182sm4.jpg',
        quote: 'Pencarian dokter bedah terhadap monster psikopat yang ia selamatkan.'
      },
      {
        id: 'summertime_render',
        searchQuery: 'Summer Time Rendering',
        title: 'Summertime Render',
        type: 'TV (25 Eps)',
        score: '8.8',
        genres: 'Mystery, Supernatural, Thriller',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx129201-HJBauga2be8I.png',
        quote: 'Time loop di pulau terpencil memburu bayangan pembunuh.'
      },
      {
        id: 'yakusoku_no_neverland',
        searchQuery: 'Yakusoku no Neverland',
        title: 'Yakusoku no Neverland (The Promised Neverland)',
        type: 'TV (12 Eps)',
        score: '8.6',
        genres: 'Mystery, Psychological, Thriller',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101759-8UR7r9MNVpz2.jpg',
        quote: 'Kenyataan mengerikan di balik panti asuhan yang damai.'
      },
      {
        id: 'code_geass',
        searchQuery: 'Code Geass',
        title: 'Code Geass: Hangyaku no Lelouch',
        type: 'TV (25 Eps)',
        score: '9.0',
        genres: 'Action, Drama, Mecha, Sci-Fi',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1575-hsmWM2ydNm1m.jpg',
        quote: 'Lelouch memimpin revolusi dengan kekuatan mutlak Geass.'
      }
    ]
  },
  {
    id: 'romance',
    title: 'Romansa Baper & Manis',
    subtitle: 'Kisah Cinta Bikin Senyum-Senyum Sendiri',
    iconName: 'Heart',
    accentColor: '#ef4444',
    bgGradient: 'from-rose-500/20 to-red-600/10',
    borderGlow: 'border-rose-500/40',
    description: 'Bikin hati berbunga-bunga! Romansa manis anak sekolah, dinamika karakter yang menggemaskan, dan momen uwu yang bikin baper.',
    curatedAnime: [
      {
        id: 'kaguya_sama',
        searchQuery: 'Kaguya-sama',
        title: 'Kaguya-sama wa Kokurasetai (Love Is War)',
        type: 'TV (12 Eps)',
        score: '8.9',
        genres: 'Comedy, Psychological, Romance',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101921-ufrjLzhSz7L1.jpg',
        quote: 'Perang otak antara dua jenius gengsi: siapa nembak duluan kalah!'
      },
      {
        id: 'horimiya',
        searchQuery: 'Horimiya',
        title: 'Horimiya',
        type: 'TV (13 Eps)',
        score: '8.7',
        genres: 'Comedy, Romance, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx124080-3i22mRVPBS0T.jpg',
        quote: 'Sisi rahasia dua remaja yang saling melengkapi di luar sekolah.'
      },
      {
        id: 'boku_no_kokoro',
        searchQuery: 'Boku no Kokoro no Yabai Yatsu',
        title: 'Boku no Kokoro no Yabai Yatsu (The Dangers in My Heart)',
        type: 'TV (12 Eps)',
        score: '8.9',
        genres: 'Comedy, Romance, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153152-Xnwmx7wuoIWV.jpg',
        quote: 'Perkembangan cinta paling manis dan tulus antara dua insan berbeda.'
      },
      {
        id: 'sono_bisque_doll',
        searchQuery: 'Sono Bisque Doll',
        title: 'Sono Bisque Doll wa Koi wo Suru (My Dress-Up Darling)',
        type: 'TV (12 Eps)',
        score: '8.6',
        genres: 'Comedy, Romance, Slice of Life',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx132405-qP7FQYGmNI3d.jpg',
        quote: 'Dunia cosplay mempertemukan pembuat boneka dan gadis populer.'
      },
      {
        id: 'toradora',
        searchQuery: 'Toradora',
        title: 'Toradora!',
        type: 'TV (25 Eps)',
        score: '8.5',
        genres: 'Comedy, Drama, Romance',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx4224-PXVMBLNwy2aF.jpg',
        quote: 'Naga dan Harimau saku: dari saling bantu jadi saling jatuh cinta.'
      },
      {
        id: 'bunny_girl_senpai',
        searchQuery: 'Seishun Buta Yarou',
        title: 'Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai',
        type: 'TV (13 Eps)',
        score: '8.7',
        genres: 'Drama, Mystery, Psychological, Romance',
        cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101291-wfEdgPqtfU0l.jpg',
        quote: 'Sindrom Pubertas dan pertemuan dengan senior berkostum kelinci.'
      }
    ]
  }
];

// Data untuk Roulette / Slot Machine Pools
export const ROULETTE_POOL = MOOD_CATEGORIES.flatMap((m) =>
  m.curatedAnime.map((a) => ({
    ...a,
    moodId: m.id,
    moodTitle: m.title,
    moodColor: m.accentColor,
    moodIcon: m.iconName
  }))
);
