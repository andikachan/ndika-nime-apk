import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { bumpQuestProgress } from '../_lib/quests.js';

// File berdiri sendiri (redis client sendiri), mengikuti pola comments/reactions.
// redis singleton from _lib/redis.js

// ===== BANK SOAL =====
// Semua soal berbasis FAKTA umum tentang anime (nama karakter, studio, mangaka, dll),
// bukan kutipan dialog/narasi berhak cipta — jadi aman dipakai sebagai trivia.
// correct = index jawaban benar (0-3). id harus stabil (JANGAN diubah urutannya
// setelah live, karena dipakai buat validasi submit).
const QUESTION_BANK = [
  // Naruto
  { id: 'q01', q: 'Siapa nama karakter utama dalam anime Naruto?', choices: ['Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha'], correct: 0 },
  { id: 'q02', q: 'Siapa mangaka (penulis manga) dari One Piece?', choices: ['Masashi Kishimoto', 'Eiichiro Oda', 'Akira Toriyama', 'Tite Kubo'], correct: 1 },
  { id: 'q03', q: 'Apa julukan kelompok bajak laut yang dipimpin Luffy di One Piece?', choices: ['Bajak Laut Topi Jerami', 'Bajak Laut Api Merah', 'Bajak Laut Kumo', 'Bajak Laut Hitam'], correct: 0 },
  { id: 'q04', q: 'Berapa jumlah Dragon Ball yang harus dikumpulkan untuk memanggil Shenron?', choices: ['5', '6', '7', '9'], correct: 2 },
  { id: 'q05', q: 'Siapa nama shinigami yang menjatuhkan Death Note ke dunia manusia?', choices: ['Rem', 'Ryuk', 'Sidoh', 'Gelus'], correct: 1 },
  { id: 'q06', q: 'Apa nama organisasi kriminal yang memburu para Bijuu di Naruto?', choices: ['Akatsuki', 'Kirigakure', 'Root', 'Anbu'], correct: 0 },
  { id: 'q07', q: 'Studio animasi mana yang memproduksi film-film seperti Spirited Away?', choices: ['Toei Animation', 'Studio Ghibli', 'Kyoto Animation', 'Bones'], correct: 1 },
  { id: 'q08', q: 'Siapa sutradara paling terkenal di balik banyak film Studio Ghibli?', choices: ['Hayao Miyazaki', 'Makoto Shinkai', 'Mamoru Hosoda', 'Satoshi Kon'], correct: 0 },
  { id: 'q09', q: 'Apa nama akademi tempat para calon pahlawan belajar di My Hero Academia?', choices: ['Shiketsu High', 'U.A. High School', 'Seiai Academy', 'Ouran Academy'], correct: 1 },
  { id: 'q10', q: 'Apa julukan Izuku Midoriya sebelum ia mendapatkan kekuatan (Quirk)?', choices: ['Deku', 'Kacchan', 'All Might', 'Eraser'], correct: 0 },
  { id: 'q11', q: 'Siapa nama guru dari Tim 7 (Naruto, Sasuke, Sakura) di Naruto?', choices: ['Iruka Umino', 'Kakashi Hatake', 'Jiraiya', 'Asuma Sarutobi'], correct: 1 },
  { id: 'q12', q: 'Berapa jumlah pedang yang biasa digunakan Roronoa Zoro sekaligus dalam gaya bertarungnya?', choices: ['1', '2', '3', '4'], correct: 2 },
  { id: 'q13', q: 'Siapa nama hero utama dalam One Punch Man?', choices: ['Genos', 'Saitama', 'Bang', 'Mumen Rider'], correct: 1 },
  { id: 'q14', q: 'Siapa mangaka pencipta Death Note?', choices: ['Tsugumi Ohba', 'Naoki Urasawa', 'Kentaro Miura', 'Hiromu Arakawa'], correct: 0 },
  { id: 'q15', q: 'Apa nama kapal pertama milik kru Topi Jerami sebelum Thousand Sunny?', choices: ['Moby Dick', 'Going Merry', 'Oro Jackson', 'Red Force'], correct: 1 },
  { id: 'q16', q: 'Anime apa yang terkenal dengan setting game VR di mana karakter yang mati di game akan mati sungguhan?', choices: ['Sword Art Online', '.hack//Sign', 'Log Horizon', 'Overlord'], correct: 0 },
  { id: 'q17', q: 'Apa julukan Saitama di kalangan Asosiasi Pahlawan karena penampilannya?', choices: ['Silver Fang', 'Caped Baldy', 'Blast', 'Metal Bat'], correct: 1 },
  { id: 'q18', q: 'Siapa mangaka pencipta Dragon Ball?', choices: ['Akira Toriyama', 'Rumiko Takahashi', 'Go Nagai', 'Leiji Matsumoto'], correct: 0 },
  { id: 'q19', q: 'Apa nama jenis pedang yang dipakai para Pembasmi Iblis di Demon Slayer (Kimetsu no Yaiba)?', choices: ['Pedang Nichirin', 'Pedang Kusanagi', 'Pedang Zangetsu', 'Pedang Murasame'], correct: 0 },
  { id: 'q20', q: 'Siapa mangaka pencipta Attack on Titan (Shingeki no Kyojin)?', choices: ['Hajime Isayama', 'Kentaro Miura', 'Yusuke Murata', 'Kohei Horikoshi'], correct: 0 },
  { id: 'q21', q: 'Siapa karakter utama yang menelan jari Sukuna di awal cerita Jujutsu Kaisen?', choices: ['Megumi Fushiguro', 'Yuji Itadori', 'Nobara Kugisaki', 'Satoru Gojo'], correct: 1 },
  { id: 'q22', q: 'Siapa nama karakter utama yang berubah menjadi setengah ghoul di Tokyo Ghoul?', choices: ['Ken Kaneki', 'Shu Tsukiyama', 'Uta', 'Amon Koutarou'], correct: 0 },
  { id: 'q23', q: 'Siapa nama ayah dari Gon Freecss yang dicarinya sepanjang cerita Hunter x Hunter?', choices: ['Ging Freecss', 'Silva Zoldyck', 'Isaac Netero', 'Kite'], correct: 0 },
  { id: 'q24', q: 'Apa sebutan untuk pedang roh yang dimiliki para Shinigami di Bleach?', choices: ['Zanpakuto', 'Nichirin', 'Kagune', 'Cursed Tool'], correct: 0 },
  { id: 'q25', q: 'Apa nama kekuatan khusus pada mata yang dimiliki Lelouch di Code Geass?', choices: ['Sharingan', 'Geass', 'Byakugan', 'Rinnegan'], correct: 1 },
  { id: 'q26', q: 'Chihiro bekerja di tempat apa selama terjebak di dunia roh dalam film Spirited Away?', choices: ['Restoran', 'Pemandian air panas', 'Sekolah sihir', 'Kastil terbang'], correct: 1 },
  
  // Tambahan baru - Naruto & One Piece
  { id: 'q27', q: 'Apa nama desa kelahiran Naruto Uzumaki?', choices: ['Konohagakure', 'Sunagakure', 'Kirigakure', 'Iwagakure'], correct: 0 },
  { id: 'q28', q: 'Siapa nama saudara laki-laki Itachi Uchiha?', choices: ['Sasuke Uchiha', 'Shisui Uchiha', 'Obito Uchiha', 'Madara Uchiha'], correct: 0 },
  { id: 'q29', q: 'Apa nama buah iblis yang dimakan Luffy?', choices: ['Gomu Gomu no Mi', 'Mera Mera no Mi', 'Hito Hito no Mi', 'Uo Uo no Mi'], correct: 0 },
  { id: 'q30', q: 'Siapa nama karakter yang memiliki kemampuan membekukan di One Piece?', choices: ['Aokiji', 'Akainu', 'Kizaru', 'Fujitora'], correct: 0 },
  
  // Attack on Titan
  { id: 'q31', q: 'Apa nama tembok terluar yang melindungi umat manusia di Attack on Titan?', choices: ['Tembok Maria', 'Tembok Rose', 'Tembok Sina', 'Tembok Titan'], correct: 0 },
  { id: 'q32', q: 'Siapa nama Titan yang mampu memanipulasi Titan lain?', choices: ['Founding Titan', 'Attack Titan', 'Colossal Titan', 'Armored Titan'], correct: 0 },
  { id: 'q33', q: 'Apa nama divisi khusus yang menangani Titan di Attack on Titan?', choices: ['Scout Regiment', 'Garrison', 'Military Police', 'Survey Corps'], correct: 0 },
  
  // Demon Slayer
  { id: 'q34', q: 'Siapa nama iblis paling kuat di Demon Slayer?', choices: ['Muzan Kibutsuji', 'Kokushibo', 'Doma', 'Akaza'], correct: 0 },
  { id: 'q35', q: 'Apa nama nafas yang digunakan Tanjiro Kamado?', choices: ['Water Breathing', 'Fire Breathing', 'Thunder Breathing', 'Wind Breathing'], correct: 0 },
  { id: 'q36', q: 'Siapa nama adik perempuan Tanjiro?', choices: ['Nezuko Kamado', 'Kanao Tsuyuri', 'Shinobu Kocho', 'Mitsuri Kanroji'], correct: 0 },
  
  // Jujutsu Kaisen
  { id: 'q37', q: 'Siapa nama guru Yuji Itadori di Jujutsu Kaisen?', choices: ['Satoru Gojo', 'Kento Nanami', 'Masamichi Yaga', 'Shoko Ieiri'], correct: 0 },
  { id: 'q38', q: 'Apa nama teknik kutukan yang dimiliki Gojo Satoru?', choices: ['Limitless', 'Shadow', 'Curse Manipulation', 'Ten Shadows'], correct: 0 },
  { id: 'q39', q: 'Siapa nama siswa dari Kyoto yang merupakan rival Yuji?', choices: ['Aoi Todo', 'Mai Zenin', 'Noritoshi Kamo', 'Kasumi Miwa'], correct: 0 },
  
  // Bleach
  { id: 'q40', q: 'Siapa nama karakter utama di Bleach?', choices: ['Ichigo Kurosaki', 'Rukia Kuchiki', 'Renji Abarai', 'Toshiro Hitsugaya'], correct: 0 },
  { id: 'q41', q: 'Apa nama organisasi Shinigami di Bleach?', choices: ['Soul Society', 'Gotei 13', 'Arrancar', 'Quincy'], correct: 1 },
  { id: 'q42', q: 'Siapa nama Hollow yang paling kuat di Bleach?', choices: ['Aizen Sosuke', 'Yhwach', 'Barragan', 'Ulquiorra'], correct: 1 },
  
  // My Hero Academia
  { id: 'q43', q: 'Siapa nama All Might yang sebenarnya?', choices: ['Toshinori Yagi', 'All For One', 'Endeavor', 'Gran Torino'], correct: 0 },
  { id: 'q44', q: 'Apa nama Quirk yang dimiliki Katsuki Bakugo?', choices: ['Explosion', 'Fire', 'Blast', 'Shockwave'], correct: 0 },
  { id: 'q45', q: 'Siapa nama siswa dengan Quirk yang bisa menciptakan apa pun dari tubuhnya?', choices: ['Momo Yaoyorozu', 'Fumikage Tokoyami', 'Mina Ashido', 'Ochaco Uraraka'], correct: 0 },
  
  // Fullmetal Alchemist
  { id: 'q46', q: 'Siapa nama dua bersaudara utama di Fullmetal Alchemist?', choices: ['Edward dan Alphonse Elric', 'Roy dan Maes Hughes', 'Ling dan Lan Fan', 'Scar dan Kimblee'], correct: 0 },
  { id: 'q47', q: 'Apa nama batu yang menjadi pusat cerita Fullmetal Alchemist?', choices: ['Philosopher\'s Stone', 'Blood Stone', 'Magic Stone', 'Eternal Stone'], correct: 0 },
  { id: 'q48', q: 'Apa negara tempat cerita Fullmetal Alchemist berlangsung?', choices: ['Amestris', 'Xerxes', 'Creta', 'Drachma'], correct: 0 },
  
  // Fate Series
  { id: 'q49', q: 'Siapa nama Servant yang dipanggil di Fate Stay Night?', choices: ['Saber', 'Archer', 'Lancer', 'Rider'], correct: 0 },
  { id: 'q50', q: 'Apa nama ritual di Fate Series untuk memanggil Servant?', choices: ['Holy Grail War', 'Servant War', 'Mage War', 'Hero War'], correct: 0 },
  { id: 'q51', q: 'Siapa nama Master Shirou Emiya di Fate Stay Night?', choices: ['Rin Tohsaka', 'Sakura Matou', 'Illyasviel', 'Shirou Emiya'], correct: 3 },
  
  // Gundam
  { id: 'q52', q: 'Apa nama mecha utama di Mobile Suit Gundam?', choices: ['Gundam', 'Zaku', 'Gouf', 'Dom'], correct: 0 },
  { id: 'q53', q: 'Siapa nama karakter utama di Gundam Wing?', choices: ['Heero Yuy', 'Duo Maxwell', 'Trowa Barton', 'Quatre Raberba'], correct: 0 },
  
  // Studio Ghibli
  { id: 'q54', q: 'Apa nama film Studio Ghibli tentang putri yang jatuh dari langit?', choices: ['Castle in the Sky', 'Kiki\'s Delivery Service', 'Spirited Away', 'Princess Mononoke'], correct: 0 },
  { id: 'q55', q: 'Apa nama film Studio Ghibli yang menceritakan tentang kastil terbang?', choices: ['Howl\'s Moving Castle', 'Castle in the Sky', 'Porco Rosso', 'The Wind Rises'], correct: 0 },
  { id: 'q56', q: 'Siapa nama karakter utama di My Neighbor Totoro?', choices: ['Satsuki Kusakabe', 'Mei Kusakabe', 'Totoro', 'Kanta Ogaki'], correct: 0 },
  
  // Dragon Ball
  { id: 'q57', q: 'Apa nama teknik terkenal dari Goku?', choices: ['Kamehameha', 'Special Beam Cannon', 'Spirit Bomb', 'Galick Gun'], correct: 0 },
  { id: 'q58', q: 'Siapa nama rival utama Goku di Dragon Ball?', choices: ['Vegeta', 'Piccolo', 'Frieza', 'Cell'], correct: 0 },
  { id: 'q59', q: 'Apa nama bentuk Super Saiyan yang pertama kali muncul di Dragon Ball Z?', choices: ['Super Saiyan', 'Super Saiyan 2', 'Super Saiyan 3', 'Super Saiyan God'], correct: 0 },
  
  // SAO
  { id: 'q60', q: 'Siapa nama karakter utama di Sword Art Online?', choices: ['Kirito', 'Asuna', 'Leafa', 'Sinon'], correct: 0 },
  { id: 'q61', q: 'Apa nama game pertama di Sword Art Online?', choices: ['Sword Art Online', 'ALO', 'GGO', 'Underworld'], correct: 0 },
  { id: 'q62', q: 'Siapa nama creator SAO yang menjebak para pemain?', choices: ['Kayaba Akihiko', 'Sugou Nobuyuki', 'Kikuoka Seijirou', 'Shigemura Takeru'], correct: 0 },
  
  // Tokyo Revengers
  { id: 'q63', q: 'Siapa nama karakter utama di Tokyo Revengers?', choices: ['Takemichi Hanagaki', 'Mikey', 'Draken', 'Hinata Tachibana'], correct: 0 },
  { id: 'q64', q: 'Apa nama geng yang dipimpin Mikey?', choices: ['Tokyo Manji Gang', 'Black Dragon', 'Valhalla', 'Tenjiku'], correct: 0 },
  
  // Chainsaw Man
  { id: 'q65', q: 'Siapa nama karakter utama di Chainsaw Man?', choices: ['Denji', 'Power', 'Aki Hayakawa', 'Makima'], correct: 0 },
  { id: 'q66', q: 'Apa nama iblis yang menjadi kekuatan Denji?', choices: ['Chainsaw Devil', 'Gun Devil', 'Control Devil', 'Fox Devil'], correct: 0 },
  
  // Spy x Family
  { id: 'q67', q: 'Siapa nama karakter utama yang merupakan mata-mata di Spy x Family?', choices: ['Loid Forger', 'Yor Forger', 'Anya Forger', 'Bond'], correct: 0 },
  { id: 'q68', q: 'Apa nama organisasi Loid bekerja di Spy x Family?', choices: ['WISE', 'Westalis', 'Ostania', 'Garden'], correct: 0 },
  
  // KNY - Kimetsu no Yaiba
  { id: 'q69', q: 'Apa nama iblis bulan atas yang paling kuat di Demon Slayer?', choices: ['Kokushibo', 'Doma', 'Akaza', 'Hantengu'], correct: 0 },
  { id: 'q70', q: 'Siapa nama iblis yang menjadi mentor Tanjiro?', choices: ['Kokushibo', 'Doma', 'Akaza', 'Muzan'], correct: 3 },
  
  // One Punch Man
  { id: 'q71', q: 'Apa nama organisasi pahlawan di One Punch Man?', choices: ['Hero Association', 'Monster Association', 'Hero League', 'Justice League'], correct: 0 },
  { id: 'q72', q: 'Siapa nama monster terkuat di One Punch Man?', choices: ['Boros', 'Garou', 'Catastrophe', 'God'], correct: 0 },
  
  // Hunter x Hunter
  { id: 'q73', q: 'Apa nama teknik menggunakan aura di Hunter x Hunter?', choices: ['Nen', 'Haki', 'Chakra', 'Reiatsu'], correct: 0 },
  { id: 'q74', q: 'Siapa nama karakter yang menggunakan teknik Jajanken?', choices: ['Gon Freecss', 'Killua Zoldyck', 'Kurapika', 'Leorio Paradinight'], correct: 0 },
  
  // Black Clover
  { id: 'q75', q: 'Siapa nama karakter utama di Black Clover?', choices: ['Asta', 'Yuno', 'Yami Sukehiro', 'Noelle Silva'], correct: 0 },
  { id: 'q76', q: 'Apa nama anti-sihir yang dimiliki Asta?', choices: ['Anti Magic', 'Dark Magic', 'Light Magic', 'Fire Magic'], correct: 0 },
  
  // Fairy Tail
  { id: 'q77', q: 'Siapa nama karakter utama di Fairy Tail?', choices: ['Natsu Dragneel', 'Lucy Heartfilia', 'Gray Fullbuster', 'Erza Scarlet'], correct: 0 },
  { id: 'q78', q: 'Apa nama sihir yang digunakan Natsu?', choices: ['Fire Dragon Slayer', 'Ice Dragon Slayer', 'Lightning Dragon Slayer', 'Poison Dragon Slayer'], correct: 0 },
  
  // Evangelion
  { id: 'q79', q: 'Apa nama mecha di Neon Genesis Evangelion?', choices: ['Eva Unit', 'Gundam', 'Gurren', 'Franxx'], correct: 0 },
  { id: 'q80', q: 'Siapa nama karakter utama di Evangelion?', choices: ['Shinji Ikari', 'Rei Ayanami', 'Asuka Langley', 'Kaworu Nagisa'], correct: 0 },
  
  // Code Geass
  { id: 'q81', q: 'Apa nama kemampuan yang dimiliki Lelouch?', choices: ['Geass', 'Mirage', 'Phantom', 'Ghost'], correct: 0 },
  { id: 'q82', q: 'Siapa nama sahabat Lelouch di Code Geass?', choices: ['Suzaku Kururugi', 'C.C.', 'Kallen Kozuki', 'Rolo Lamperouge'], correct: 0 },
  
  // Steins Gate
  { id: 'q83', q: 'Apa nama ilmuwan gila di Steins Gate?', choices: ['Okabe Rintaro', 'Kurisu Makise', 'Mayuri Shiina', 'Itaru Hashida'], correct: 0 },
  { id: 'q84', q: 'Apa nama microwavenya yang bisa mengirim pesan ke masa lalu?', choices: ['PhoneWave', 'Time Machine', 'D-Mail', 'Microwave'], correct: 0 },
  
  // Re:Zero
  { id: 'q85', q: 'Siapa nama karakter utama di Re:Zero?', choices: ['Subaru Natsuki', 'Emilia', 'Rem', 'Ram'], correct: 0 },
  { id: 'q86', q: 'Apa nama kemampuan Subaru di Re:Zero?', choices: ['Return by Death', 'Time Rewind', 'Revive', 'Rebirth'], correct: 0 },
  
  // Mushoku Tensei
  { id: 'q87', q: 'Siapa nama karakter utama di Mushoku Tensei?', choices: ['Rudeus Greyrat', 'Sylphiette', 'Roxy', 'Eris'], correct: 0 },
  { id: 'q88', q: 'Apa nama dunia di Mushoku Tensei?', choices: ['Six Faced World', 'Four Faced World', 'Eight Faced World', 'Ten Faced World'], correct: 0 },
  
  // Made in Abyss
  { id: 'q89', q: 'Apa nama jurang misterius di Made in Abyss?', choices: ['Abyss', 'Trench', 'Chasm', 'Rift'], correct: 0 },
  { id: 'q90', q: 'Siapa nama karakter utama di Made in Abyss?', choices: ['Riko', 'Reg', 'Nanachi', 'Ozen'], correct: 0 },
  
  // Your Name (Kimi no Na wa)
  { id: 'q91', q: 'Siapa nama karakter utama di Your Name?', choices: ['Mitsuha Miyamizu', 'Taki Tachibana', 'Miki Okudera', 'Katsuhiko Teshigawara'], correct: 0 },
  { id: 'q92', q: 'Apa nama kota tempat Mitsuha tinggal di Your Name?', choices: ['Itomori', 'Tokyo', 'Osaka', 'Kyoto'], correct: 0 },
  
  // Weathering With You
  { id: 'q93', q: 'Siapa nama karakter utama di Weathering With You?', choices: ['Hodaka Morishima', 'Hina Amano', 'Keisuke Suga', 'Natsumi Suga'], correct: 0 },
  { id: 'q94', q: 'Apa kemampuan yang dimiliki Hina di Weathering With You?', choices: ['Clear Weather', 'Rain', 'Snow', 'Wind'], correct: 0 },
  
  // 5 Centimeters per Second
  { id: 'q95', q: 'Siapa nama sutradara 5 Centimeters per Second?', choices: ['Makoto Shinkai', 'Hayao Miyazaki', 'Mamoru Hosoda', 'Satoshi Kon'], correct: 0 },
  
  // A Silent Voice
  { id: 'q96', q: 'Siapa nama karakter utama di A Silent Voice?', choices: ['Shoya Ishida', 'Shoko Nishimiya', 'Satoshi Mashiba', 'Naoka Ueno'], correct: 0 },
  { id: 'q97', q: 'Apa tema utama A Silent Voice?', choices: ['Bullying dan penyesalan', 'Cinta romantis', 'Persahabatan', 'Keluarga'], correct: 0 },
  
  // I want to eat your pancreas
  { id: 'q98', q: 'Siapa nama karakter utama di I Want to Eat Your Pancreas?', choices: ['Haruki Shiga', 'Sakura Yamauchi', 'Kyoko', 'Ryou'], correct: 0 },
  
  // Anohana
  { id: 'q99', q: 'Siapa nama karakter yang menjadi hantu di Anohana?', choices: ['Menma', 'Jinta', 'Anaru', 'Poppo'], correct: 0 },
  { id: 'q100', q: 'Apa nama kelompok persahabatan di Anohana?', choices: ['Super Peace Busters', 'Peace Makers', 'Friends Club', 'Childhood Friends'], correct: 0 },
  
  // Clannad
  { id: 'q101', q: 'Siapa nama karakter utama di Clannad?', choices: ['Tomoya Okazaki', 'Nagisa Furukawa', 'Kyou Fujibayashi', 'Tomoyo Sakagami'], correct: 0 },
  { id: 'q102', q: 'Apa nama toko roti di Clannad?', choices: ['Furukawa Bakery', 'Sakagami Bakery', 'Okazaki Bakery', 'Fujibayashi Bakery'], correct: 0 },
  
  // Violet Evergarden
  { id: 'q103', q: 'Siapa nama karakter utama di Violet Evergarden?', choices: ['Violet Evergarden', 'Gilbert Bougainvillea', 'Claudia Hodgins', 'Iris Cannary'], correct: 0 },
  { id: 'q104', q: 'Apa profesi Violet Evergarden?', choices: ['Auto Memory Doll', 'Soldier', 'Postman', 'Writer'], correct: 0 },
  
  // Haikyuu
  { id: 'q105', q: 'Siapa nama karakter utama di Haikyuu?', choices: ['Shoyo Hinata', 'Tobio Kageyama', 'Koshi Sugawara', 'Daichi Sawamura'], correct: 0 },
  { id: 'q106', q: 'Apa nama tim voli SMA di Haikyuu?', choices: ['Karasuno', 'Nekoma', 'Aobajosai', 'Shiratorizawa'], correct: 0 },
  
  // Kuroko no Basket
  { id: 'q107', q: 'Siapa nama karakter utama di Kuroko no Basket?', choices: ['Tetsuya Kuroko', 'Taiga Kagami', 'Seijuro Akashi', 'Daiki Aomine'], correct: 0 },
  { id: 'q108', q: 'Apa nama tim Kuroko di Kuroko no Basket?', choices: ['Seirin High', 'Rakuzan', 'Kaijo', 'Touou'], correct: 0 },
  
  // Free!
  { id: 'q109', q: 'Siapa nama karakter utama di Free!?', choices: ['Haruka Nanase', 'Makoto Tachibana', 'Rin Matsuoka', 'Nagisa Hazuki'], correct: 0 },
  { id: 'q110', q: 'Apa olahraga utama di Free!?', choices: ['Renang', 'Basket', 'Voli', 'Sepak bola'], correct: 0 },
  
  // Yuri on Ice
  { id: 'q111', q: 'Siapa nama karakter utama di Yuri on Ice?', choices: ['Yuri Katsuki', 'Viktor Nikiforov', 'Yuri Plisetsky', 'Otabek Altin'], correct: 0 },
  { id: 'q112', q: 'Apa olahraga utama di Yuri on Ice?', choices: ['Ice Skating', 'Ice Hockey', 'Figure Skating', 'Speed Skating'], correct: 2 },
  
  // Given
  { id: 'q113', q: 'Siapa nama karakter utama di Given?', choices: ['Ritsuka Uenoyama', 'Mafuyu Sato', 'Haruki Nakayama', 'Akihiko Kaji'], correct: 0 },
  { id: 'q114', q: 'Apa alat musik yang dimainkan Mafuyu di Given?', choices: ['Gitar', 'Bass', 'Drum', 'Keyboard'], correct: 0 },
  
  // Bocchi the Rock
  { id: 'q115', q: 'Siapa nama karakter utama di Bocchi the Rock?', choices: ['Hitori Gotoh', 'Nijika Ijichi', 'Ryo Yamada', 'Kita Ikuyo'], correct: 0 },
  { id: 'q116', q: 'Apa nama band di Bocchi the Rock?', choices: ['Kessoku Band', 'Rock Band', 'Friends Band', 'Music Band'], correct: 0 },
  
  // K-On
  { id: 'q117', q: 'Siapa nama karakter utama di K-On?', choices: ['Yui Hirasawa', 'Mio Akiyama', 'Ritsu Tainaka', 'Tsumugi Kotobuki'], correct: 0 },
  { id: 'q118', q: 'Apa nama klub musik di K-On?', choices: ['Light Music Club', 'Music Club', 'Band Club', 'Rock Club'], correct: 0 },
  
  // Love Live
  { id: 'q119', q: 'Siapa nama karakter utama di Love Live?', choices: ['Honoka Kosaka', 'Umi Sonoda', 'Kotori Minami', 'Eli Ayase'], correct: 0 },
  { id: 'q120', q: 'Apa nama grup idola di Love Live?', choices: ['μ\'s', 'Aqours', 'Saint Snow', 'Nijigasaki'], correct: 0 }
];

const QUESTIONS_PER_DAY = 5;
const XP_PER_CORRECT = 60; // 1 menit setara XP per jawaban benar

// Server Vercel jalan di UTC, user kita WIB (UTC+7, no DST) — digeser dulu
// biar soal trivia harian ganti jam 00:00 WIB, bukan jam 07:00 WIB.
const todayStr = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Shuffle deterministik berbasis seed string — dipakai supaya semua user
// dapat set soal & urutan pilihan yang SAMA pada tanggal yang sama.
const seededShuffle = (array, seedStr) => {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Ambil N soal hari ini dari bank, urutan pilihan jawaban juga diacak per-soal
// (seed beda per soal supaya nggak semua soal punya pola posisi jawaban yang sama)
const getTodayQuestions = () => {
  const date = todayStr();
  const picked = seededShuffle(QUESTION_BANK, date).slice(0, QUESTIONS_PER_DAY);
  return picked.map((item) => {
    const order = seededShuffle(
      item.choices.map((text, idx) => ({ text, idx })),
      `${date}:${item.id}`
    );
    return {
      id: item.id,
      q: item.q,
      choices: order.map((o) => o.text),
      // Peta posisi tampilan -> index asli, dipakai server buat cek jawaban.
      // TIDAK dikirim ke client.
      _answerMap: order.map((o) => o.idx),
      _correctDisplayIndex: order.findIndex((o) => o.idx === item.correct)
    };
  });
};

// verifyUserId imported from _lib/auth.js

const answerKey = (userId, date) => `trivia:answer:${userId}:${date}`;
const totalKey = (userId) => `trivia:total:${userId}`;

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
    // ===== GET /api/v1/trivia/today =====
    // Balikin soal hari ini (tanpa kunci jawaban), atau hasil kalau user sudah main hari ini.
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const date = todayStr();
      const userId = verifyUserId(req);
      const questions = getTodayQuestions();
      const publicQuestions = questions.map(({ id, q, choices }) => ({ id, q, choices }));

      let submission = null;
      if (userId) {
        const raw = await redis.get(answerKey(userId, date));
        submission = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      }

      const totalRaw = userId ? await redis.get(totalKey(userId)) : null;
      const totalCorrect = totalRaw ? parseInt(totalRaw, 10) || 0 : 0;

      return res.json({
        success: true,
        date,
        loggedIn: !!userId,
        alreadyAnswered: !!submission,
        submission: submission || null,
        questions: submission ? null : publicQuestions,
        totalCorrect
      });
    } catch (error) {
      console.error('❌ Trivia today error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'submit') {
    // ===== POST /api/v1/trivia/submit { answers: [{ id, choiceIndex }] } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu untuk main trivia' });
      }

      const date = todayStr();
      const existing = await redis.get(answerKey(userId, date));
      if (existing) {
        const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
        return res.status(409).json({ success: false, error: 'Sudah main hari ini', submission: parsed });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const answers = Array.isArray(body?.answers) ? body.answers : [];

      const questions = getTodayQuestions();
      const qMap = new Map(questions.map((q) => [q.id, q]));

      let score = 0;
      const detail = questions.map((q) => {
        const given = answers.find((a) => a.id === q.id);
        const choiceIndex = typeof given?.choiceIndex === 'number' ? given.choiceIndex : -1;
        const isCorrect = choiceIndex === q._correctDisplayIndex;
        if (isCorrect) score += 1;
        return {
          id: q.id,
          q: q.q,
          choices: q.choices,
          choiceIndex,
          correctIndex: q._correctDisplayIndex,
          correct: isCorrect
        };
      });

      const bonusSeconds = score * XP_PER_CORRECT;

      const submission = {
        date,
        score,
        total: questions.length,
        bonusSeconds,
        answers: detail,
        submittedAt: new Date().toISOString()
      };

      await redis.set(answerKey(userId, date), JSON.stringify(submission));
      await redis.incrby(totalKey(userId), score);

      // ===== QUEST: bump progress main trivia (cukup dengan ikut main, bukan skor) =====
      await bumpQuestProgress(redis, userId, 'trivia_play', 1);

      // ===== Terapkan bonus XP ke watchTime/level user, lalu update leaderboard =====
      if (bonusSeconds > 0) {
        const userData = await redis.get(`user:${userId}`);
        if (userData) {
          const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
          const newWatchTime = (user.watchTime || 0) + bonusSeconds;
          user.watchTime = newWatchTime;
          user.level = Math.floor(newWatchTime / 600);
          user.lastWatchUpdate = new Date().toISOString();
          await redis.set(`user:${userId}`, JSON.stringify(user));
          await redis.zadd('leaderboard', { score: newWatchTime, member: userId });
        }
      }

      const totalRaw = await redis.get(totalKey(userId));

      return res.json({
        success: true,
        submission,
        totalCorrect: totalRaw ? parseInt(totalRaw, 10) || 0 : score
      });
    } catch (error) {
      console.error('❌ Trivia submit error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Unknown action' });
  }
}
