import { verifyUserId, getJwtSecret } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import axios from 'axios';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';
import { bumpQuestProgress } from '../_lib/quests.js';
import { attachClanBadges, chargeGiveExpDrop, claimExpDropFromComment, getUserClanId } from '../_lib/clan.js';

// Fitur sosial: follow/unfollow antar user.
// Redis keys:
//   followers:{userId} -> SET userId yang mem-follow userId ini
//   following:{userId} -> SET userId yang di-follow oleh userId ini
// redis singleton from _lib/redis.js

const followersKey = (userId) => `followers:${userId}`;
const followingKey = (userId) => `following:${userId}`;
const lastSeenKey = (userId) => `lastSeen:${userId}`;
const profileViewsKey = (userId) => `profile_views:${userId}`;

// User dianggap online kalau heartbeat terakhirnya kurang dari ambang ini.
// Client ngirim heartbeat tiap ~30 detik, jadi 90 detik ngasih toleransi
// buat delay jaringan / tab lagi background sebelum dianggap offline.
const ONLINE_THRESHOLD_MS = 90 * 1000;

// Maksimal riwayat "siapa yang liat profil" yang disimpan per user,
// biar sorted set-nya gak numpuk gede terus di Redis.
const MAX_PROFILE_VIEWS = 300;

// verifyUserId imported from _lib/auth.js

// Ambil profil publik minimal dari daftar userId (buat list followers/following)
const publicProfiles = async (userIds) => {
  if (!userIds.length) return [];
  const capped = userIds.slice(0, 100);
  const keys = capped.map((id) => `user:${id}`);
  const raws = await redis.mget(...keys);
  return capped
    .map((id, i) => {
      const raw = raws[i];
      if (!raw) return null;
      const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        id,
        name: u.name || 'User',
        picture: u.picture || null,
        frame: u.frame || null,
        level: u.level || 0,
        title: u.title || null
      };
    })
    .filter(Boolean);
};

// ============================================================
// ===== CHAT (digabung dari bekas api/v1/chat/index.js) =====
// ============================================================
const YT_API = 'https://ndikz-api.vercel.app';

// ===== HANDLE COMMAND /play =====
// ===== HANDLE COMMAND /play =====
// ===== HANDLE COMMAND /play =====
async function handlePlayCommand(query) {
  try {
    const searchRes = await fetch(`${YT_API}/search/youtube?q=${encodeURIComponent(query)}`);
    const searchData = await searchRes.json();
    
    if (!searchData.status || !searchData.result || searchData.result.length === 0) {
      return {
        message: `❌ Tidak ditemukan hasil untuk "${query}"`,
        error: true,
        results: []
      };
    }

    // ===== AMBIL HASIL PERTAMA =====
    const video = searchData.result[0];
    const { title, channel, duration, imageUrl, link } = video;
    
    // Buat pesan dengan format rapi
    let message = 
      `🎵 *YOUTUBE PLAY* 🎵\n\n` +
      `📌 *Judul:* ${title}\n` +
      `📺 *Channel:* ${channel}\n` +
      `⏳ *Durasi:* ${duration}\n` +
      `🔗 *Link:* ${link}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🎧 *Pilih format unduhan:*\n` +
      `• Audio 🎧 → Download MP3\n` +
      `• Video 🎞️ → Download MP4\n\n` +
      `💡 *Klik button di bawah untuk memilih format*`;

    return {
      message: message,
      error: false,
      results: [video],
      imageUrl: imageUrl,
      videoLink: link,
      title: title,
      channel: channel,
      duration: duration
    };
  } catch (error) {
    console.error('Play command error:', error);
    return {
      message: `❌ Gagal mencari "${query}". Silakan coba lagi.`,
      error: true,
      results: []
    };
  }
}
// ===== FILE UPLOAD HANDLER =====
// ===== FILE UPLOAD HANDLER =====
async function handleFileUpload(fileBuffer, fileName, mimeType) {
  try {
    // Deteksi tipe file
    const type = await fileTypeFromBuffer(fileBuffer);
    
    if (!type) {
      throw new Error('Unknown file type');
    }

    // Validasi tipe file yang diizinkan
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                          'video/mp4', 'video/webm', 'video/quicktime',
                          'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    
    if (!allowedTypes.includes(type.mime)) {
      throw new Error(`Tipe file tidak diizinkan. Hanya: Gambar, Video, Audio`);
    }

    // Upload ke c.termai.cc
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: `upload.${type.ext}`,
      contentType: type.mime,
    });

    const response = await axios.post(
      `${domain}/api/upload?key=${key}`,
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    if (!response?.data?.status) {
      throw new Error('Upload gagal');
    }

    // Tentukan tipe media untuk frontend
    let mediaType = 'image';
    if (type.mime.startsWith('video/')) mediaType = 'video';
    else if (type.mime.startsWith('audio/')) mediaType = 'audio';

    return {
      success: true,
      url: response.data.path,
      mediaType: mediaType,
      mimeType: type.mime,
      ext: type.ext
    };

  } catch (error) {
    console.error('Upload file error:', error);
    return {
      success: false,
      error: error.message || 'Gagal upload file'
    };
  }
}
// ===== GAME STATE MANAGEMENT =====
// ===== GAME STATE MANAGEMENT =====
// Simpan state game per user
const gameStates = new Map();

// Fungsi untuk membersihkan game state setelah waktu habis
function clearGameState(userId) {
  if (gameStates.has(userId)) {
    const state = gameStates.get(userId);
    if (state.timeout) {
      clearTimeout(state.timeout);
    }
    gameStates.delete(userId);
  }
}

// ===== HANDLE COMMAND /tebakjkt48 =====
async function handleTebakJkt48(userId, userName) {
  try {
    // Cek apakah user sedang dalam game
    if (gameStates.has(userId)) {
      return {
        message: `[GAGAL] @${userName} sedang dalam permainan. Selesaikan dulu.`,
        error: true
      };
    }

    // Ambil data soal dari GitHub
    const response = await fetch('https://raw.githubusercontent.com/NdikzOne/Game/refs/heads/main/Jkt48.json');
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return {
        message: '[GAGAL] Gagal memuat soal. Silakan coba lagi.',
        error: true
      };
    }

    // Pilih soal random
    const randomIndex = Math.floor(Math.random() * data.length);
    const soal = data[randomIndex];

    // Simpan state game
    const gameState = {
      userId: userId,
      userName: userName,
      jawaban: soal.jawaban,
      img: soal.img,
      index: soal.index,
      startTime: Date.now(),
      timeLimit: 40000, // 40 detik
      hintLevel: 0,
      isActive: true,
      timeout: null
    };

    // Set timeout untuk game over
    gameState.timeout = setTimeout(async () => {
      if (gameStates.has(userId)) {
        const state = gameStates.get(userId);
        if (state.isActive) {
          state.isActive = false;
          // Kirim pesan game over
          const botMessage = {
            id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: 'system',
            name: 'Ndichan Bot',
            picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
            message: `[WAKTU HABIS] Jawaban yang benar adalah: ${state.jawaban}\n\n@${userName} silakan coba lagi dengan /tebakjkt48`,
            timestamp: new Date().toISOString(),
            timestamp_ms: Date.now(),
            isCommand: true,
            isGameOver: true
          };
          
          // Simpan ke Redis
          await redis.lpush('chat:messages', JSON.stringify(botMessage));
          await redis.ltrim('chat:messages', 0, 99);
          
          // Hapus state
          gameStates.delete(userId);
        }
      }
    }, 40000);

    gameStates.set(userId, gameState);

    // Buat pesan dengan tombol hint
    const message = 
      `[GAME TEBAK GAMBAR JKT48]\n` +
      `----------------------------------------\n` +
      `Player: @${userName}\n` +
      `Waktu: 40 detik\n` +
      `Ketik /hint untuk bantuan\n` +
      `----------------------------------------\n` +
      `Tebak nama member di gambar ini!`;

    return {
      message: message,
      error: false,
      gameState: gameState,
      imageUrl: soal.img,
      hasImage: true
    };

  } catch (error) {
    console.error('Tebak JKT48 error:', error);
    return {
      message: '[GAGAL] Gagal memulai game. Silakan coba lagi.',
      error: true
    };
  }
}

// ===== HANDLE COMMAND /hint =====
async function handleHint(userId, userName) {
  try {
    if (!gameStates.has(userId)) {
      return {
        message: `[GAGAL] @${userName} tidak sedang dalam permainan. Ketik /tebakjkt48 untuk mulai.`,
        error: true
      };
    }

    const state = gameStates.get(userId);
    if (!state.isActive) {
      gameStates.delete(userId);
      return {
        message: `[GAGAL] Permainan sudah berakhir. Ketik /tebakjkt48 untuk mulai baru.`,
        error: true
      };
    }

    const jawaban = state.jawaban;
    const hintLevel = state.hintLevel;
    let hint = '';

    // Berikan hint berdasarkan level
    if (hintLevel === 0) {
      // Hint pertama: jumlah huruf dan huruf pertama
      const firstChar = jawaban.charAt(0);
      const wordLength = jawaban.length;
      hint = `[HINT 1] ${wordLength} huruf, dimulai dengan huruf ${firstChar}`;
      state.hintLevel = 1;
    } else if (hintLevel === 1) {
      // Hint kedua: huruf kedua dan keempat
      const chars = jawaban.split('');
      let masked = chars.map((char, index) => {
        if (index === 0 || index === 2 || index === 4) {
          return char;
        }
        return '_';
      }).join(' ');
      hint = `[HINT 2] Pola huruf: ${masked}`;
      state.hintLevel = 2;
    } else if (hintLevel === 2) {
      // Hint ketiga: semua huruf kecuali satu
      const chars = jawaban.split('');
      let masked = chars.map((char, index) => {
        if (index === chars.length - 1) {
          return '_';
        }
        return char;
      }).join(' ');
      hint = `[HINT 3] Hampir selesai! ${masked}`;
      state.hintLevel = 3;
    } else {
      // Hint keempat: jawaban lengkap (game over)
      state.isActive = false;
      if (state.timeout) {
        clearTimeout(state.timeout);
      }
      gameStates.delete(userId);
      return {
        message: `[JAWABAN] ${jawaban}\n\n@${userName} permainan selesai! Ketik /tebakjkt48 untuk bermain lagi.`,
        error: false,
        isGameOver: true
      };
    }

    // Update state
    gameStates.set(userId, state);

    return {
      message: hint,
      error: false,
      isHint: true
    };

  } catch (error) {
    console.error('Hint error:', error);
    return {
      message: '[GAGAL] Gagal memberikan hint. Silakan coba lagi.',
      error: true
    };
  }
}

// ===== HANDLE COMMAND /skip =====
async function handleSkip(userId, userName) {
  try {
    if (!gameStates.has(userId)) {
      return {
        message: `[GAGAL] @${userName} tidak sedang dalam permainan.`,
        error: true
      };
    }

    const state = gameStates.get(userId);
    if (!state.isActive) {
      gameStates.delete(userId);
      return {
        message: `[GAGAL] Permainan sudah berakhir. Ketik /tebakjkt48 untuk mulai baru.`,
        error: true
      };
    }

    const jawaban = state.jawaban;
    state.isActive = false;
    if (state.timeout) {
      clearTimeout(state.timeout);
    }
    gameStates.delete(userId);

    return {
      message: `[SKIP] Jawaban yang benar adalah: ${jawaban}\n\n@${userName} silakan coba lagi dengan /tebakjkt48`,
      error: false,
      isGameOver: true
    };

  } catch (error) {
    console.error('Skip error:', error);
    return {
      message: '[GAGAL] Gagal skip. Silakan coba lagi.',
      error: true
    };
  }
}

// ===== CEK JAWABAN DI PESAN NORMAL =====
async function checkGameAnswer(userId, userName, message) {
  try {
    if (!gameStates.has(userId)) {
      return null;
    }

    const state = gameStates.get(userId);
    if (!state.isActive) {
      gameStates.delete(userId);
      return null;
    }

    // Cek apakah jawaban benar (case insensitive)
    const userAnswer = message.trim().toUpperCase();
    const correctAnswer = state.jawaban.toUpperCase();

    if (userAnswer === correctAnswer) {
      // Jawaban benar
      state.isActive = false;
      if (state.timeout) {
        clearTimeout(state.timeout);
      }
      
      // Hitung waktu yang digunakan
      const timeUsed = Math.floor((Date.now() - state.startTime) / 1000);
      
      gameStates.delete(userId);

      return {
        message: `[BENAR] @${userName} berhasil menebak! Jawaban: ${state.jawaban}\nWaktu: ${timeUsed} detik\n\nKetik /tebakjkt48 untuk bermain lagi.`,
        isCorrect: true
      };
    }

    return null;

  } catch (error) {
    console.error('Check answer error:', error);
    return null;
  }
}
// ===== HANDLE COMMAND /afk =====
// ===== HANDLE COMMAND /afk =====
async function handleAfkCommand(userId, userName, reason = null) {
  try {
    // Simpan status AFK user ke Redis
    const afkData = {
      userId: userId,
      name: userName,
      status: 'afk',
      reason: reason || 'Tidak ada alasan',
      timestamp: Date.now()
    };
    
    await redis.set(`afk:${userId}`, JSON.stringify(afkData));
    await redis.expire(`afk:${userId}`, 86400); // Expire setelah 24 jam
    
    const message = reason 
      ? `@${userName} sedang AFK. Alasan: ${reason}`
      : `@${userName} sedang AFK.`;
      
    return {
      message: message,
      error: false,
      afkData: afkData
    };
  } catch (error) {
    console.error('AFK command error:', error);
    return {
      message: '❌ Gagal mengatur AFK. Silakan coba lagi.',
      error: true
    };
  }
}

// ===== FORMAT DURASI =====
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} hari ${hours % 24} jam`;
  } else if (hours > 0) {
    return `${hours} jam ${minutes % 60} menit`;
  } else if (minutes > 0) {
    return `${minutes} menit ${seconds % 60} detik`;
  } else {
    return `${seconds} detik`;
  }
}

// ===== HANDLE CHECK AFK =====
async function checkUserAfk(userId, userName) {
  try {
    const afkData = await redis.get(`afk:${userId}`);
    if (!afkData) return null;
    
    return typeof afkData === 'string' ? JSON.parse(afkData) : afkData;
  } catch (error) {
    console.error('Check AFK error:', error);
    return null;
  }
}

// ===== HANDLE REMOVE AFK =====
async function removeAfkStatus(userId) {
  try {
    await redis.del(`afk:${userId}`);
    return true;
  } catch (error) {
    console.error('Remove AFK error:', error);
    return false;
  }
}
// ===== HANDLE COMMAND /reset =====
async function handleResetCommand() {
  try {
    // Ambil semua pesan dari Redis
    const messages = await redis.lrange('chat:messages', 0, 99);
    const totalMessages = messages.length;

    // Hapus semua pesan
    await redis.del('chat:messages');
    
    // Tambahkan pesan selamat datang
    const welcomeMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: `Chat telah di-reset oleh admin. ${totalMessages} pesan berhasil dihapus.\n\nSelamat datang kembali di Chat Global Ndichan!`,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };

    await redis.lpush('chat:messages', JSON.stringify(welcomeMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return {
      success: true,
      message: welcomeMessage,
      deletedCount: totalMessages
    };
  } catch (error) {
    console.error('Reset command error:', error);
    return {
      success: false,
      message: 'Gagal mereset chat. Silakan coba lagi.',
      error: true
    };
  }
}
// ===== HANDLE COMMAND /delallnsfw =====
async function handleDeleteAllNsfw() {
  try {
    // Ambil semua pesan dari Redis
    const messages = await redis.lrange('chat:messages', 0, 99);
    let deletedCount = 0;
    let remainingMessages = [];

    // Filter pesan yang bukan NSFW
    for (const msgData of messages) {
      try {
        const msg = typeof msgData === 'string' ? JSON.parse(msgData) : msgData;
        // Cek apakah pesan memiliki flag nsfw
        if (msg.nsfw === true) {
          deletedCount++;
        } else {
          remainingMessages.push(msgData);
        }
      } catch (error) {
        remainingMessages.push(msgData);
      }
    }

    // Hapus semua pesan lama
    await redis.del('chat:messages');
    
    // Simpan kembali pesan yang tidak NSFW dengan urutan yang benar
    if (remainingMessages.length > 0) {
      // ===== PERBAIKAN: Balik urutan sebelum push =====
      // Karena lpush menambahkan ke depan, kita perlu balik urutan
      // agar pesan terbaru tetap di atas
      const reversedMessages = remainingMessages.reverse();
      
      // Push satu per satu atau sekaligus
      for (const msg of reversedMessages) {
        await redis.lpush('chat:messages', msg);
      }
      
      // Atau bisa juga pakai spread dengan urutan yang sudah dibalik
      // await redis.lpush('chat:messages', ...reversedMessages);
    }

    // Kirim notifikasi
    const notification = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: `Berhasil menghapus ${deletedCount} pesan NSFW dari chat.`,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };

    await redis.lpush('chat:messages', JSON.stringify(notification));
    await redis.ltrim('chat:messages', 0, 99);

    return {
      success: true,
      message: notification,
      deletedCount: deletedCount
    };
  } catch (error) {
    console.error('Delete all NSFW error:', error);
    return {
      success: false,
      message: 'Gagal menghapus pesan NSFW. Silakan coba lagi.',
      error: true
    };
  }
}
async function handlePinkCommand() {
    try {
        // Informasi sistem
        const systemInfo = {
            name: 'Ndichan System',
            version: '2.5.0',
            status: '🟢 Online',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            redisStatus: '✅ Connected'
        };

        // Format uptime
        const uptimeHours = Math.floor(systemInfo.uptime / 3600);
        const uptimeMinutes = Math.floor((systemInfo.uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(systemInfo.uptime % 60);
        const uptimeStr = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

        // Format memory
        const memoryUsed = (systemInfo.memory.heapUsed / 1024 / 1024).toFixed(2);
        const memoryTotal = (systemInfo.memory.heapTotal / 1024 / 1024).toFixed(2);
        const memoryStr = `${memoryUsed} MB / ${memoryTotal} MB`;

        // Ambil jumlah pesan di chat
        const messages = await redis.lrange('chat:messages', 0, -1);
        const totalMessages = messages.length;

        // Ambil jumlah user terdaftar
        const userKeys = await redis.keys('user:*');
        const totalUsers = userKeys.filter(key => !key.includes('email:')).length;

        // Ambil jumlah admin
        const adminIds = await getAdminIds();
        const totalAdmins = adminIds.length;

        // Buat pesan informasi
        const message = 
            `🌸 *PINK SYSTEM INFO* 🌸\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 *System:* ${systemInfo.name}\n` +
            `🔢 *Version:* ${systemInfo.version}\n` +
            `📊 *Status:* ${systemInfo.status}\n` +
            `⏱️ *Uptime:* ${uptimeStr}\n` +
            `💾 *Memory:* ${memoryStr}\n` +
            `🖥️ *Platform:* ${systemInfo.platform}\n` +
            `⚡ *Node.js:* ${systemInfo.nodeVersion}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 *STATISTICS*\n` +
            `👥 *Total Users:* ${totalUsers}\n` +
            `👑 *Total Admins:* ${totalAdmins}\n` +
            `💬 *Total Messages:* ${totalMessages}\n` +
            `📡 *Redis:* ${systemInfo.redisStatus}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💖 *Powered by Ndichan*`;

        return {
            message: message,
            error: false,
            data: systemInfo
        };

    } catch (error) {
        console.error('Pink command error:', error);
        return {
            message: `❌ Gagal mendapatkan informasi sistem. Silakan coba lagi.`,
            error: true
        };
    }
}
// ===== HANDLE COMMAND /ytmp3 =====
// ===== HANDLE COMMAND /ytmp3 =====
// ===== HANDLE COMMAND /ytmp3 =====
// ===== HANDLE COMMAND /ytmp3 =====
const key = "AIzaBj7z2z3xBjsk";
const domain = "https://c.termai.cc";

async function uploadFile(file) {
  const type = await fileTypeFromBuffer(file);

  if (!type) throw new Error("Unknown file type");

  const form = new FormData();
  form.append("file", file, {
    filename: `audio.${type.ext}`,
    contentType: type.mime,
  });

  const { data } = await axios.post(
    `${domain}/api/upload?key=${key}`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  return data;
}

async function handleYtmp3(url) {
  try {
    // Ambil link download dari API
    const downloadRes = await fetch(
      `${YT_API}/download/ytmp3?url=${encodeURIComponent(url)}`
    );
    const data = await downloadRes.json();

    if (!data.status) {
      return {
        message: "❌ Gagal mendapatkan link download.",
        error: true,
      };
    }

    // Download audio menjadi Buffer
    const audioRes = await axios.get(data.download, {
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const buffer = Buffer.from(audioRes.data);

    // Upload ke c.termai.cc
    const uploaded = await uploadFile(buffer);

    if (!uploaded?.status) {
      return {
        message: "❌ Upload audio gagal.",
        error: true,
      };
    }

    return {
      message: `🎵 **${data.title}**\n━━━━━━━━━━━━━━━━━\n\n📥 [Download Audio](${uploaded.path})`,
      error: false,
      downloadUrl: uploaded.path,
      title: data.title,
    };
  } catch (err) {
    console.error(err);
    return {
      message: "❌ Terjadi kesalahan.",
      error: true,
    };
  }
}
// ===== HANDLE COMMAND /ytmp4 =====
async function handleYtmp4(url) {
  try {
    const downloadRes = await fetch(`${YT_API}/download/ytmp4?url=${encodeURIComponent(url)}`);
    const data = await downloadRes.json();
    
    if (!data.status) {
      return {
        message: `❌ Gagal mendapatkan link download. Pastikan URL YouTube valid.`,
        error: true
      };
    }

    // Hanya tampilkan judul + download button
    return {
      message: `🎬 **${data.title}**\n━━━━━━━━━━━━━━━━━\n\n📥 [Download MP4](${data.download})`,
      error: false,
      downloadUrl: data.download,
      title: data.title
    };
  } catch (error) {
    console.error('Ytmp4 error:', error);
    return {
      message: `❌ Gagal mendapatkan link download. Silakan coba lagi.`,
      error: true
    };
  }
}
// ===== HELPER: Get admin IDs =====
async function getAdminIds() {
  try {
    const adminData = await redis.get('admin:ids');
    if (!adminData) {
      await redis.set('admin:ids', JSON.stringify([]));
      return [];
    }
    let adminIds = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
    if (!Array.isArray(adminIds)) {
      adminIds = [];
      await redis.set('admin:ids', JSON.stringify(adminIds));
    }
    return adminIds;
  } catch (error) {
    console.error('Error getting admin IDs:', error);
    return [];
  }
}

// ===== HANDLE COMMAND /level =====
async function handleLevelCommand(userId, userName, userPicture, targetName = null) {
  let targetId = userId;
  let targetUser = null;
  
  // Jika targetName diberikan, cari user tersebut
  if (targetName) {
    const keys = await redis.keys('user:*');
    for (const key of keys) {
      if (key.includes('email:')) continue;
      const data = await redis.get(key);
      if (data) {
        const u = typeof data === 'string' ? JSON.parse(data) : data;
        if (u.name && u.name.toLowerCase() === targetName.toLowerCase()) {
          targetId = key.replace('user:', '');
          targetUser = u;
          break;
        }
      }
    }
    
    if (!targetUser) {
      return {
        message: `❌ User "${targetName}" tidak ditemukan.`,
        error: true
      };
    }
  } else {
    const userData = await redis.get(`user:${userId}`);
    if (!userData) {
      return {
        message: `❌ User tidak ditemukan.`,
        error: true
      };
    }
    targetUser = typeof userData === 'string' ? JSON.parse(userData) : userData;
  }

  const level = targetUser.level || 0;
  const title = targetUser.title || 'Anime Newbie';
  const watchTime = targetUser.watchTime || 0;
  
  // Format watch time
  const hours = Math.floor(watchTime / 3600);
  const minutes = Math.floor((watchTime % 3600) / 60);
  const watchTimeStr = hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;
  
  // Next level progress
  const nextLevelTime = (level + 1) * 600;
  const currentLevelTime = level * 600;
  const progress = Math.min(((watchTime - currentLevelTime) / 600) * 100, 100);
  const progressStr = Math.round(progress);
  
  // Level icon
  const getLevelIcon = (lvl) => {
    if (lvl >= 1000) return '👑';
    if (lvl >= 500) return '⭐';
    if (lvl >= 300) return '🌟';
    if (lvl >= 200) return '💫';
    if (lvl >= 150) return '✨';
    if (lvl >= 100) return '🔥';
    if (lvl >= 50) return '⚡';
    if (lvl >= 30) return '🎯';
    if (lvl >= 20) return '🎮';
    if (lvl >= 10) return '📺';
    return '🎬';
  };

  // Cek admin
  const adminIds = await getAdminIds();
  const isAdmin = adminIds.includes(targetId);

  // Progress bar
  const barLength = 20;
  const filled = Math.floor((progress / 100) * barLength);
  const progressBar = '▰'.repeat(filled) + '▱'.repeat(barLength - filled);

  const isOwn = targetId === userId;

  return {
    message: `${getLevelIcon(level)} **${targetUser.name}** ${isAdmin ? '👑' : ''} ${isOwn ? '(Kamu)' : ''}\n━━━━━━━━━━━━━━━━━\n📊 **Level:** ${level}\n🏷️ **Title:** ${title}\n⏱️ **Total Nonton:** ${watchTimeStr}\n📈 **Progress:** ${progressStr}% ke Lv.${level + 1}\n━━━━━━━━━━━━━━━━━\n${progressBar}`,
    error: false
  };
}
// ===== PARSE MULTIPART FORM =====
function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let boundary = null;
    
    // Get boundary from content-type
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return reject(new Error('No boundary found'));
    }
    boundary = boundaryMatch[1];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const result = parseMultipartBuffer(buffer, boundary);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseMultipartBuffer(buffer, boundary) {
  const result = { file: null };
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundary = Buffer.from(`--${boundary}--`);
  
  let start = 0;
  let parts = [];
  
  // Split by boundary
  while (start < buffer.length) {
    const index = buffer.indexOf(boundaryBuffer, start);
    if (index === -1) break;
    
    // Skip the boundary line
    start = index + boundaryBuffer.length;
    
    // Check if it's the end boundary
    const endCheck = buffer.slice(start, start + 2);
    if (endCheck.toString() === '--') {
      break;
    }
    
    // Find the next boundary
    const nextIndex = buffer.indexOf(boundaryBuffer, start);
    if (nextIndex === -1) {
      // Find end boundary
      const endIndex = buffer.indexOf(endBoundary, start);
      if (endIndex !== -1) {
        parts.push(buffer.slice(start, endIndex));
      }
      break;
    }
    
    // Extract part
    const part = buffer.slice(start, nextIndex);
    if (part.length > 0) {
      parts.push(part);
    }
    start = nextIndex;
  }
  
  // Parse each part
  for (const part of parts) {
    // Find headers end (double CRLF)
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    
    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);
    
    // Check if it's a file
    const filenameMatch = headers.match(/filename="(.+?)"/);
    const nameMatch = headers.match(/name="(.+?)"/);
    const contentTypeMatch = headers.match(/Content-Type: (.+?)(\r\n|$)/);
    
    if (filenameMatch && contentTypeMatch) {
      // It's a file
      result.file = {
        data: content,
        filename: filenameMatch[1],
        mimetype: contentTypeMatch[1].trim(),
        fieldname: nameMatch ? nameMatch[1] : 'file'
      };
    } else if (nameMatch && !filenameMatch) {
      // It's a text field
      const fieldName = nameMatch[1];
      const fieldValue = content.toString().trim();
      if (fieldName === 'caption') {
        result.caption = fieldValue;
      }
    }
  }
  
  return result;
}
async function chatHandler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET - Get messages
    // GET - Get messages
if (req.method === 'GET') {
  const messages = await redis.lrange('chat:messages', 0, 99);
  
  // Jika kosong, tambahkan dummy message dengan /menu
  if (messages.length === 0) {
    const dummyMessage = {
      id: 'dummy_1',
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: 'Selamat datang di Chat Global Ndichan! 🎉\n\nKetik /menu untuk melihat daftar perintah.',
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now()
    };
    await redis.lpush('chat:messages', JSON.stringify(dummyMessage));
    
    const updatedMessages = await redis.lrange('chat:messages', 0, 99);
    const parsedMessages = updatedMessages
      .map(msg => {
        try {
          return typeof msg === 'string' ? JSON.parse(msg) : msg;
        } catch {
          return null;
        }
      })
      .filter(msg => msg !== null)
      .reverse();
    
    return res.json({ 
      success: true, 
      messages: parsedMessages,
      count: parsedMessages.length
    });
  }
  
  const parsedMessages = messages
    .map(msg => {
      try {
        return typeof msg === 'string' ? JSON.parse(msg) : msg;
      } catch {
        return null;
      }
    })
    .filter(msg => msg !== null)
    .reverse();

  return res.json({ 
    success: true, 
    messages: parsedMessages,
    count: parsedMessages.length
  });
}
if (req.method === 'PATCH') {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const decoded = jwt.verify(token, getJwtSecret());
  const userId = decoded.userId;

  const userData = await redis.get(`user:${userId}`);
  if (!userData) return res.status(401).json({ error: 'User not found' });

  const { action, messageId, newMessage, emoji } = req.body;
  if (!action || !messageId) {
    return res.status(400).json({ error: 'action dan messageId wajib diisi' });
  }

  const messages = await redis.lrange('chat:messages', 0, 99);
  let targetIndex = -1;
  let targetMsg = null;

  for (let i = 0; i < messages.length; i++) {
    const parsed = typeof messages[i] === 'string' ? JSON.parse(messages[i]) : messages[i];
    if (parsed.id === messageId) {
      targetIndex = i;
      targetMsg = parsed;
      break;
    }
  }

  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Pesan tidak ditemukan' });
  }

  if (action === 'edit') {
    if (targetMsg.userId !== userId) {
      return res.status(403).json({ error: 'Tidak diizinkan mengedit pesan ini' });
    }
    if (!newMessage || !newMessage.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    if (newMessage.length > 500) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (max 500)' });
    }
    targetMsg.message = newMessage.trim();
    targetMsg.edited = true;
    targetMsg.editedAt = new Date().toISOString();

  } else if (action === 'react') {
    if (!emoji) return res.status(400).json({ error: 'emoji wajib diisi' });
    if (!targetMsg.reactions) targetMsg.reactions = {};
    if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];

    const idx = targetMsg.reactions[emoji].indexOf(userId);
    if (idx === -1) {
      targetMsg.reactions[emoji].push(userId);
    } else {
      targetMsg.reactions[emoji].splice(idx, 1);
      if (targetMsg.reactions[emoji].length === 0) delete targetMsg.reactions[emoji];
    }

  } else if (action === 'pin') {
    const adminIds = await getAdminIds();
    if (!adminIds.includes(userId)) {
      return res.status(403).json({ error: 'Hanya admin yang bisa pin pesan' });
    }
    // Unpin pesan lain dulu (cuma 1 pesan yang bisa dipin)
    if (!targetMsg.pinned) {
      for (let i = 0; i < messages.length; i++) {
        if (i === targetIndex) continue;
        const p = typeof messages[i] === 'string' ? JSON.parse(messages[i]) : messages[i];
        if (p.pinned) {
          p.pinned = false;
          await redis.lset('chat:messages', i, JSON.stringify(p));
        }
      }
    }
    targetMsg.pinned = !targetMsg.pinned;

  } else {
    return res.status(400).json({ error: 'Action tidak dikenal' });
  }

  await redis.lset('chat:messages', targetIndex, JSON.stringify(targetMsg));

  return res.json({ success: true, message: targetMsg });
}
    // POST - Send message
if (req.method === 'POST') {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const decoded = jwt.verify(token, getJwtSecret());
  const userId = decoded.userId;

  const userData = await redis.get(`user:${userId}`);
  if (!userData) {
    return res.status(401).json({ error: 'User not found' });
  }

  const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

  // ===== QUEST: bump progress kirim pesan chat =====
  // Ditaruh di titik masuk universal (sebelum bercabang ke media/text/command)
  // biar kehitung untuk semua jenis pengiriman pesan.
  await bumpQuestProgress(redis, userId, 'chat_message', 1);

  // ===== PARSE BODY =====
  let message = req.body.message;
let mediaUrl = req.body.mediaUrl;
let mediaType = req.body.mediaType;
let fileName = req.body.fileName;
let replyTo = req.body.replyTo || null;

  // ===== HANDLE MEDIA URL (dari frontend upload langsung) =====
  if (mediaUrl && mediaType) {
    // Buat pesan dengan media dari URL
    const mediaMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      name: user.name,
      picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
      message: message || '',
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      hasMedia: true,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      fileName: fileName || 'file',
      replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, message: (replyTo.message || '').substring(0, 100) } : null
    };

    await redis.lpush('chat:messages', JSON.stringify(mediaMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return res.json({ success: true, message: mediaMessage });
  }

  // ===== COMMAND / TEXT MESSAGE =====
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const trimmedMessage = message.trim();

      // ===== CHECK FOR COMMANDS =====
      
      // Handle /level command (own level)
      if (trimmedMessage.toLowerCase() === '/level') {
      const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
        const result = await handleLevelCommand(userId, user.name, user.picture);
        
        const botMessage = {
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: 'system',
          name: 'Ndichan Bot',
          picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
          message: result.message,
          timestamp: new Date().toISOString(),
          timestamp_ms: Date.now(),
          isCommand: true
        };

        await redis.lpush('chat:messages', JSON.stringify(botMessage));
        await redis.ltrim('chat:messages', 0, 99);

        return res.json({ 
          success: true, 
          message: botMessage
        });
      }
      if (trimmedMessage.toLowerCase().startsWith('/ytmp3 ')) {
      const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
    const url = trimmedMessage.substring(7).trim();
    
    // Validasi URL
    if (!url.includes('youtube.com/watch?v=') && !url.includes('youtu.be/')) {
      const errorMessage = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'system',
        name: 'Ndichan Bot',
        picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
        message: `❌ URL YouTube tidak valid. Contoh: https://youtube.com/watch?v=xxx`,
        timestamp: new Date().toISOString(),
        timestamp_ms: Date.now(),
        isCommand: true
      };
      await redis.lpush('chat:messages', JSON.stringify(errorMessage));
      await redis.ltrim('chat:messages', 0, 99);
      return res.json({ success: true, message: errorMessage });
    }

    const result = await handleYtmp3(url);
    
    const botMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: result.message,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true,
      hasMedia: true,
      mediaType: 'audio',
      mediaUrl: result.downloadUrl
    };

    await redis.lpush('chat:messages', JSON.stringify(botMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return res.json({ success: true, message: botMessage });
  }
// ===== COMMAND: /tebakjkt48 =====
if (trimmedMessage.toLowerCase() === '/tebakjkt48') {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  
  const result = await handleTebakJkt48(userId, user.name);
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: result.message,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: result.hasImage || false,
    imageUrl: result.imageUrl || null,
    isGame: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}

// ===== COMMAND: /hint =====
if (trimmedMessage.toLowerCase() === '/hint') {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  
  const result = await handleHint(userId, user.name);
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: result.message,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}

// ===== COMMAND: /skip =====
if (trimmedMessage.toLowerCase() === '/skip') {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  
  const result = await handleSkip(userId, user.name);
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: result.message,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
  // ===== COMMAND: /ytmp4 [url] =====
  if (trimmedMessage.toLowerCase().startsWith('/ytmp4 ')) {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
    const url = trimmedMessage.substring(7).trim();
    
    if (!url.includes('youtube.com/watch?v=') && !url.includes('youtu.be/')) {
      const errorMessage = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'system',
        name: 'Ndichan Bot',
        picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
        message: `❌ URL YouTube tidak valid. Contoh: https://youtube.com/watch?v=xxx`,
        timestamp: new Date().toISOString(),
        timestamp_ms: Date.now(),
        isCommand: true
      };
      await redis.lpush('chat:messages', JSON.stringify(errorMessage));
      await redis.ltrim('chat:messages', 0, 99);
      return res.json({ success: true, message: errorMessage });
    }

    const result = await handleYtmp4(url);
    
    const botMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: result.message,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true,
      hasMedia: true,
      mediaType: 'video',
      mediaUrl: result.downloadUrl
    };

    await redis.lpush('chat:messages', JSON.stringify(botMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return res.json({ success: true, message: botMessage });
  }
  // ===== COMMAND: /delallnsfw (Admin only) =====
if (trimmedMessage.toLowerCase() === '/delallnsfw') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  // Cek apakah user adalah admin
  const adminIds = await getAdminIds();
  if (!adminIds.includes(userId)) {
    const errorMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: 'Akses ditolak. Perintah ini hanya untuk admin.',
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };
    
    await redis.lpush('chat:messages', JSON.stringify(errorMessage));
    await redis.ltrim('chat:messages', 0, 99);
    
    return res.json({ success: true, message: errorMessage });
  }

  const result = await handleDeleteAllNsfw();
  
  if (result.success) {
    return res.json({ success: true, message: result.message });
  } else {
    const errorMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: result.message,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };
    
    await redis.lpush('chat:messages', JSON.stringify(errorMessage));
    await redis.ltrim('chat:messages', 0, 99);
    
    return res.json({ success: true, message: errorMessage });
  }
}
// ===== COMMAND: /afk =====
if (trimmedMessage.toLowerCase().startsWith('/afk')) {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  
  // Ambil alasan jika ada
  const parts = trimmedMessage.split(' ');
  let reason = null;
  if (parts.length > 1) {
    reason = parts.slice(1).join(' ');
  }
  
  const result = await handleAfkCommand(userId, user.name, reason);
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: result.message,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
  if (trimmedMessage.toLowerCase() === '/pink') {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
    const result = await handlePinkCommand();
    
    const botMessage = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'system',
        name: 'Ndichan Bot',
        picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
        message: result.message,
        timestamp: new Date().toISOString(),
        timestamp_ms: Date.now(),
        isCommand: true,
        isPinkInfo: true
    };

    await redis.lpush('chat:messages', JSON.stringify(botMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return res.json({ 
        success: true, 
        message: botMessage 
    });
}

  // ===== COMMAND: /play [query] =====
if (trimmedMessage.toLowerCase().startsWith('/play ')) {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  const query = trimmedMessage.substring(6).trim();
  const result = await handlePlayCommand(query);
  
  // Buat pesan dengan button
  let messageText = result.message;
  
  // Tambahkan button inline di pesan
  messageText += `\n\n🎵 [Putar Audio](${result.videoLink}|audio)  🎬 [Putar Video](${result.videoLink}|video)`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: messageText,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    imageUrl: result.imageUrl,
    videoLink: result.videoLink,
    title: result.title
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
// ===== COMMAND: /reset (Admin only) =====
if (trimmedMessage.toLowerCase() === '/reset') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  // Cek apakah user adalah admin
  const adminIds = await getAdminIds();
  if (!adminIds.includes(userId)) {
    const errorMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: 'Akses ditolak. Perintah ini hanya untuk admin.',
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };
    
    await redis.lpush('chat:messages', JSON.stringify(errorMessage));
    await redis.ltrim('chat:messages', 0, 99);
    
    return res.json({ success: true, message: errorMessage });
  }

  const result = await handleResetCommand();
  
  if (result.success) {
    return res.json({ success: true, message: result.message });
  } else {
    const errorMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: result.message,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true
    };
    
    await redis.lpush('chat:messages', JSON.stringify(errorMessage));
    await redis.ltrim('chat:messages', 0, 99);
    
    return res.json({ success: true, message: errorMessage });
  }
}
if (trimmedMessage.toLowerCase() === '/waifu') {
  const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));

  // 2. PROSES COMMAND DAN TAMPILKAN RESPON BOT
  const response = await fetch('https://api.waifu.im/images?IncludedTags=waifu&isAnimated=false&orientation=Landscape');
  const data = await response.json();

  const imageUrl = data.items[0].url;
  const artist = data.items[0].artists[0]?.name || 'Unknown';
  const tag = data.items[0].tags[0]?.name || 'No tag';
  const source = data.items[0].source;

  const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;

  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    sfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/hentai') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=hentai&orderBy=Random&isNsfw=All&isAnimated=false&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/oppai') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=oppai&orderBy=Random&orientation=Landscape&isNsfw=True');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/ero') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=ero&orderBy=Random&isNsfw=True&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/milf') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=milf&orderBy=Random&isNsfw=True&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/ass') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=ass&orderBy=Random&isNsfw=True&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/paizuri') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=paizuri&orderBy=Random&isNsfw=True&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
if (trimmedMessage.toLowerCase() === '/ecchi') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
const response = await fetch('https://api.waifu.im/images?includedTags=ecchi&orderBy=Random&isNsfw=All&orientation=Landscape');
const data = await response.json();

const imageUrl = data.items[0].url;
const artist = data.items[0].artists[0]?.name || 'Unknown';
const tag = data.items[0].tags[0]?.name || 'No tag';
const source = data.items[0].source;

// Buat deskripsi dari data yang ada
const description = `Artist: ${artist}, Tag: ${tag}, Source: ${source}`;
  
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: description,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    hasImage: true,
    nsfw: true,
    imageUrl: imageUrl,
    title: artist
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}
// ===== COMMAND: /help =====
if (trimmedMessage.toLowerCase() === '/help' || trimmedMessage.toLowerCase() === '/menu') {
const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
  const helpMessage = `
╭───〔 NDICHAN BOT 〕

MUSIC
• /play <query>
• /ytmp3 <url>
• /ytmp4 <url>

SYSTEM
• /pink

USER
• /level
• /level @username

AFK
• /afk
• /afk <alasan>

GAME
• /tebakjkt48

ANIME
• /waifu

NSFW
• /hentai
• /oppai
• /ero
• /milf
• /ass
• /paizuri
• /ecchi

ADMIN
• /delallnsfw
• /reset

OTHER
• /help
• /menu

────────────────────
Send a YouTube link for automatic download.
`;
  const botMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: helpMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);

  return res.json({ success: true, message: botMessage });
}

  // ===== COMMAND: /ytmp3 (tanpa url, dari button) =====
  // Cek apakah pesan berupa link YouTube dengan format khusus
  const ytMatch = trimmedMessage.match(/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    // Ini adalah link YouTube, kita proses sebagai perintah /ytmp3
    const url = trimmedMessage;
    const result = await handleYtmp3(url);
    
    const botMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      name: 'Ndichan Bot',
      picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
      message: result.message,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      isCommand: true,
      hasMedia: true,
      mediaType: 'audio',
      mediaUrl: result.downloadUrl
    };

    await redis.lpush('chat:messages', JSON.stringify(botMessage));
    await redis.ltrim('chat:messages', 0, 99);

    return res.json({ success: true, message: botMessage });
  }

      // Handle /level @username (cek user lain)
      if (trimmedMessage.toLowerCase().startsWith('/level @')) {
      const userMessageData = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    name: user.name,
    picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
    message: trimmedMessage,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now()
  };

  await redis.lpush('chat:messages', JSON.stringify(userMessageData));
        const targetName = trimmedMessage.substring(8).trim();
        const result = await handleLevelCommand(userId, user.name, user.picture, targetName);
        
        const botMessage = {
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: 'system',
          name: 'Ndichan Bot',
          picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
          message: result.message,
          timestamp: new Date().toISOString(),
          timestamp_ms: Date.now(),
          isCommand: true
        };

        await redis.lpush('chat:messages', JSON.stringify(botMessage));
        await redis.ltrim('chat:messages', 0, 99);

        return res.json({ 
          success: true, 
          message: botMessage
        });
      }

      // ===== NORMAL MESSAGE =====
      // ===== NORMAL MESSAGE =====
// ===== NORMAL MESSAGE =====
if (message.length > 500) {
  return res.status(400).json({ error: 'Message too long (max 500 characters)' });
}

// Cek status AFK user
const afkStatus = await checkUserAfk(userId, user.name);
if (afkStatus) {
  // Hitung durasi AFK
  const afkDuration = Date.now() - afkStatus.timestamp;
  const durationStr = formatDuration(afkDuration);
  
  // User kembali dari AFK
  await removeAfkStatus(userId);
  
  // Kirim notifikasi user kembali dengan durasi
  const backMessage = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: `@${user.name} telah kembali dari AFK (${durationStr})`,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true
  };
  
  await redis.lpush('chat:messages', JSON.stringify(backMessage));
}
// ===== CEK JAWABAN GAME =====
const gameResult = await checkGameAnswer(userId, user.name, trimmedMessage);
if (gameResult) {
  const botMessage = {
    id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'system',
    name: 'Ndichan Bot',
    picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
    message: gameResult.message,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    isCommand: true,
    isGameResult: true
  };

  await redis.lpush('chat:messages', JSON.stringify(botMessage));
  await redis.ltrim('chat:messages', 0, 99);
}

// Cek mention ke user yang AFK
const mentionMatch = message.match(/@(\w+)/g);
if (mentionMatch) {
  for (const mention of mentionMatch) {
    const mentionedUser = mention.substring(1); // Hapus @
    // Cari user yang disebut
    const keys = await redis.keys('user:*');
    let mentionedUserId = null;
    for (const key of keys) {
      if (key.includes('email:')) continue;
      const data = await redis.get(key);
      if (data) {
        const u = typeof data === 'string' ? JSON.parse(data) : data;
        if (u.name && u.name.toLowerCase() === mentionedUser.toLowerCase()) {
          mentionedUserId = key.replace('user:', '');
          break;
        }
      }
    }
    
    if (mentionedUserId && mentionedUserId !== userId) {
      const mentionedAfk = await checkUserAfk(mentionedUserId, mentionedUser);
      if (mentionedAfk) {
        // Hitung durasi AFK user yang disebut
        const afkDuration = Date.now() - mentionedAfk.timestamp;
        const durationStr = formatDuration(afkDuration);
        
        // User yang disebut sedang AFK
        const afkNotice = {
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: 'system',
          name: 'Ndichan Bot',
          picture: 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg',
          message: `@${mentionedUser} sedang AFK (${durationStr}). ${mentionedAfk.reason ? 'Alasan: ' + mentionedAfk.reason : ''}`,
          timestamp: new Date().toISOString(),
          timestamp_ms: Date.now(),
          isCommand: true
        };
        
        await redis.lpush('chat:messages', JSON.stringify(afkNotice));
      }
    }
  }
}

const messageData = {
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  userId: user.id,
  name: user.name,
  picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F6CF80&color=0a0a0c&size=128`,
  message: message.trim(),
  timestamp: new Date().toISOString(),
  timestamp_ms: Date.now(),
  replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, message: (replyTo.message || '').substring(0, 100) } : null
};

await redis.lpush('chat:messages', JSON.stringify(messageData));
await redis.ltrim('chat:messages', 0, 99);

return res.json({ 
  success: true, 
  message: messageData
});
    }

    // DELETE - Delete message
    if (req.method === 'DELETE') {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.userId;

      const { messageId } = req.body;

      if (!messageId) {
        return res.status(400).json({ error: 'Message ID required' });
      }

      const messages = await redis.lrange('chat:messages', 0, 99);

      let found = false;
      for (let i = 0; i < messages.length; i++) {
        try {
          const msg = typeof messages[i] === 'string' ? JSON.parse(messages[i]) : messages[i];
          // Allow system messages to be deleted by anyone (bot messages)
          if (msg.id === messageId && (msg.userId === userId || msg.userId === 'system')) {
            await redis.lrem('chat:messages', 1, messages[i]);
            found = true;
            break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }

      if (!found) {
        return res.status(404).json({ error: 'Message not found or not authorized' });
      }

      return res.json({ success: true, message: 'Message deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Chat API error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// ===== COMMENTS (digabung dari bekas api/v1/comments/[...action].js) =====
// ============================================================
const SUPER_ADMIN_IDS = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];

const MAX_MESSAGE_LENGTH = 500;
const PAGE_SIZE = 20;
const MAX_STORED_PER_TARGET = 500; // batas penyimpanan per target biar list tidak membengkak

const isValidHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const commentKey = (type, id) => `comments:${type}:${id}`;

const safeParse = (item) => {
  try {
    if (!item) return null;
    if (typeof item === 'object') return item;
    return JSON.parse(item);
  } catch {
    return null;
  }
};

async function commentsHandler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (action === 'list') {
    // ===== GET /api/v1/comments/list?type=anime&id=slug:1&cursor=0 =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { type, id } = req.query;
      const cursor = Math.max(0, parseInt(req.query.cursor, 10) || 0);

      if (!VALID_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type dan id wajib diisi' });
      }

      const key = commentKey(type, id);
      const raw = await redis.lrange(key, cursor, cursor + PAGE_SIZE - 1);
      const comments = raw.map(safeParse).filter(Boolean);

      const total = await redis.llen(key);
      const hasMore = cursor + PAGE_SIZE < total;

      return res.json({
        success: true,
        comments,
        total,
        hasMore,
        nextCursor: hasMore ? cursor + PAGE_SIZE : null,
      });
    } catch (error) {
      console.error('❌ List comments error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'post') {
    // ===== POST /api/v1/comments/post =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu untuk berkomentar' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { type, id, image } = body || {};
      const message = typeof body?.message === 'string' ? body.message.trim() : '';
      const imageUrl = typeof image === 'string' ? image.trim() : '';

      if (!VALID_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type dan id wajib diisi' });
      }

      if (!message && !imageUrl) {
        return res.status(400).json({ error: 'Komentar tidak boleh kosong' });
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Komentar maksimal ${MAX_MESSAGE_LENGTH} karakter` });
      }

      // Hanya izinkan URL gambar/GIF yang valid (client sudah membatasi upload
      // ke tipe image/* saja, ini validasi tambahan di sisi server)
      if (imageUrl && !isValidHttpUrl(imageUrl)) {
        return res.status(400).json({ error: 'URL gambar tidak valid' });
      }

      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(401).json({ error: 'User not found' });
      }
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

      // ===== Opsional: sisipin EXP drop ke komentar ini (Give EXP) =====
      // User boleh nempelin sejumlah EXP ke komentarnya sendiri biar orang
      // lain (di luar clan-nya) bisa klaim langsung dari komentar itu.
      // Gak ada batas waktu -- tetap kebuka sampai semua slot habis diklaim.
      let expDrop = null;
      const giveExp = body?.giveExp;
      if (giveExp && (giveExp.amount || giveExp.maxClaims)) {
        const charge = await chargeGiveExpDrop(redis, userId, giveExp.amount, giveExp.maxClaims);
        if (!charge.success) {
          return res.status(400).json({ error: charge.error });
        }
        expDrop = {
          amount: charge.amount,
          maxClaims: charge.maxClaims,
          claimedCount: 0,
          claimedBy: [],
          giverId: userId,
          clanId: charge.clanId
        };
      }

      const comment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type,
        targetId: id,
        userId,
        name: user.name || 'User',
        picture: user.picture || null,
        message,
        image: imageUrl || null,
        createdAt: new Date().toISOString(),
        expDrop
      };

      const key = commentKey(type, id);
      await redis.lpush(key, JSON.stringify(comment));
      await redis.ltrim(key, 0, MAX_STORED_PER_TARGET - 1);

      // ===== QUEST: bump progress komentar =====
      await bumpQuestProgress(redis, userId, 'comment', 1);

      return res.json({ success: true, comment });
    } catch (error) {
      console.error('❌ Post comment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'delete') {
    // ===== POST /api/v1/comments/delete =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { type, id, commentId } = body || {};

      if (!VALID_TYPES.includes(type) || !id || !commentId) {
        return res.status(400).json({ error: 'type, id, dan commentId wajib diisi' });
      }

      const key = commentKey(type, id);
      const raw = await redis.lrange(key, 0, -1);

      let targetRaw = null;
      let target = null;
      for (const item of raw) {
        const parsed = safeParse(item);
        if (parsed?.id === commentId) {
          targetRaw = item;
          target = parsed;
          break;
        }
      }

      if (!target) {
        return res.status(404).json({ error: 'Komentar tidak ditemukan' });
      }

      const adminIds = await getAdminIds();
      const isAdmin = adminIds.includes(userId) || SUPER_ADMIN_IDS.includes(userId);

      if (target.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Kamu tidak bisa menghapus komentar orang lain' });
      }

      await redis.lrem(key, 1, targetRaw);

      return res.json({ success: true });
    } catch (error) {
      console.error('❌ Delete comment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'claim-exp') {
    // ===== POST /api/v1/social/comment-claim-exp =====
    // Klaim EXP yang nempel di komentar orang lain (Give EXP drop).
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { type, id, commentId } = body || {};
      if (!VALID_TYPES.includes(type) || !id || !commentId) {
        return res.status(400).json({ error: 'type, id, dan commentId wajib diisi' });
      }

      const key = commentKey(type, id);
      const raw = await redis.lrange(key, 0, -1);

      let index = -1;
      let comment = null;
      for (let i = 0; i < raw.length; i++) {
        const parsed = safeParse(raw[i]);
        if (parsed?.id === commentId) { index = i; comment = parsed; break; }
      }

      if (!comment) {
        return res.status(404).json({ error: 'Komentar tidak ditemukan' });
      }

      const result = await claimExpDropFromComment(redis, userId, comment);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await redis.lset(key, index, JSON.stringify(comment));

      return res.json({ success: true, amount: result.amount, newLevel: result.newLevel, comment });
    } catch (error) {
      console.error('❌ Claim exp error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Unknown action' });
  }
}

// ============================================================
// ===== REACTIONS (digabung dari bekas api/v1/reactions/[...action].js) =====
// ============================================================
// Tipe target reaksi yang valid — sama seperti komentar, jadi 1 episode/chapter
// punya 1 "mood komunitas" yang selaras dengan kolom komentarnya.
const VALID_TYPES = ['anime', 'manga', 'chapter'];

// Emoji yang diizinkan. Dibatasi supaya agregasi gampang & konsisten di UI.
const VALID_EMOJIS = ['🔥', '😂', '😭', '😍', '😱', '👍'];

const countsKey = (type, id) => `reactions:${type}:${id}`; // hash: emoji -> count
const userKey = (type, id, userId) => `reactions:${type}:${id}:user:${userId}`; // string: emoji pilihan user

// Ambil semua count emoji buat 1 target, isi 0 untuk emoji yang belum pernah dipakai
const getCounts = async (type, id) => {
  const raw = (await redis.hgetall(countsKey(type, id))) || {};
  const counts = {};
  for (const emoji of VALID_EMOJIS) {
    const val = raw[emoji];
    counts[emoji] = val ? parseInt(val, 10) || 0 : 0;
  }
  return counts;
};

async function reactionsHandler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (action === 'get') {
    // ===== GET /api/v1/reactions/get?type=anime&id=slug:1 =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { type, id } = req.query;
      if (!VALID_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type dan id wajib diisi' });
      }

      const userId = verifyUserId(req);
      const [counts, userReaction] = await Promise.all([
        getCounts(type, id),
        userId ? redis.get(userKey(type, id, userId)) : Promise.resolve(null)
      ]);

      return res.json({
        success: true,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        userReaction: userReaction || null
      });
    } catch (error) {
      console.error('❌ Get reactions error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'toggle') {
    // ===== POST /api/v1/reactions/toggle { type, id, emoji } =====
    // Satu user cuma boleh punya 1 reaksi aktif per target (mirip vote mood).
    // Klik emoji yang sama lagi -> reaksi dibatalkan. Klik emoji lain -> reaksi pindah.
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu untuk kasih reaksi' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { type, id, emoji } = body || {};

      if (!VALID_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type dan id wajib diisi' });
      }
      if (!VALID_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Emoji tidak valid' });
      }

      const cKey = countsKey(type, id);
      const uKey = userKey(type, id, userId);
      const previous = await redis.get(uKey);

      let userReaction = emoji;

      if (previous === emoji) {
        // Klik emoji yang sama -> batalkan reaksi
        await redis.hincrby(cKey, emoji, -1);
        await redis.del(uKey);
        userReaction = null;
      } else {
        if (previous) {
          // Pindah dari emoji lama ke emoji baru
          await redis.hincrby(cKey, previous, -1);
        }
        await redis.hincrby(cKey, emoji, 1);
        await redis.set(uKey, emoji);
      }

      // Jaga-jaga biar count nggak pernah minus (misal race condition ganda klik)
      const rawCounts = (await redis.hgetall(cKey)) || {};
      for (const [key, val] of Object.entries(rawCounts)) {
        const num = parseInt(val, 10) || 0;
        if (num < 0) await redis.hset(cKey, { [key]: 0 });
      }

      const counts = await getCounts(type, id);

      return res.json({
        success: true,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        userReaction
      });
    } catch (error) {
      console.error('❌ Toggle reaction error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Unknown action' });
  }
}

// ===== FORWARDER: chat / comments / reactions digabung ke sini =====
// Chat, Comments, dan Reactions tetap punya modul implementasi sendiri
// (lebih aman & gampang dirawat daripada nulis ulang ribuan baris logic
// dalam satu file raksasa), tapi semuanya cuma bisa diakses lewat SATU
// pintu publik: /api/v1/social/:action. Fungsi ini nge-forward request ke
// handler aslinya, dan buat chat/comments juga nyisipin `clanBadge` (tag,
// icon, warna, level clan) ke tiap pesan/komentar berdasarkan pengirimnya,
// biar identitas clan keliatan di mana-mana sesuai spek.
async function forwardWithBadges(req, res, delegateHandler, { arrayField, singleField } = {}) {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    return (async () => {
      try {
        if (arrayField && payload && Array.isArray(payload[arrayField])) {
          await attachClanBadges(redis, payload[arrayField], 'userId');
        }
        if (singleField && payload && payload[singleField]) {
          await attachClanBadges(redis, [payload[singleField]], 'userId');
        }
      } catch (err) {
        console.error('❌ Gagal nempel clan badge:', err);
      }
      return originalJson(payload);
    })();
  };
  return delegateHandler(req, res);
}

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== CHAT (global) — semua method (GET/POST/PATCH/DELETE) diteruskan
  // apa adanya ke implementasi chat asli, cuma nambahin clanBadge di respons =====
  if (action === 'chat') {
    return forwardWithBadges(req, res, chatHandler, { arrayField: 'messages', singleField: 'message' });
  }

  // ===== COMMENTS =====
  if (action === 'comment-list' || action === 'comment-post' || action === 'comment-delete' || action === 'comment-claim-exp') {
    req.query.action = action.replace('comment-', ''); // list | post | delete
    return forwardWithBadges(req, res, commentsHandler, { arrayField: 'comments', singleField: 'comment' });
  }

  // ===== REACTIONS (gak ada identitas pengirim yang ditampilkan, gak perlu badge) =====
  if (action === 'reaction-get' || action === 'reaction-toggle') {
    req.query.action = action.replace('reaction-', ''); // get | toggle
    return reactionsHandler(req, res);
  }

  if (action === 'follow' || action === 'unfollow') {
    // ===== POST /api/v1/social/follow | /unfollow { targetUserId } =====
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const targetUserId = body?.targetUserId;
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId wajib diisi' });
      }
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Gak bisa follow diri sendiri' });
      }

      const targetExists = await redis.get(`user:${targetUserId}`);
      if (!targetExists) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
      }

      if (action === 'follow') {
        await redis.sadd(followersKey(targetUserId), userId);
        await redis.sadd(followingKey(userId), targetUserId);
      } else {
        await redis.srem(followersKey(targetUserId), userId);
        await redis.srem(followingKey(userId), targetUserId);
      }

      const [followerCount, followingCount] = await Promise.all([
        redis.scard(followersKey(targetUserId)),
        redis.scard(followingKey(targetUserId))
      ]);

      return res.json({
        success: true,
        isFollowing: action === 'follow',
        followerCount: followerCount || 0,
        followingCount: followingCount || 0
      });
    } catch (error) {
      console.error('❌ Follow/unfollow error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'status') {
    // ===== GET /api/v1/social/status?userId=X =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const viewerId = verifyUserId(req);
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'userId wajib diisi' });
      }

      const [followerCount, followingCount, isFollowing, lastSeen] = await Promise.all([
        redis.scard(followersKey(userId)),
        redis.scard(followingKey(userId)),
        viewerId ? redis.sismember(followersKey(userId), viewerId) : Promise.resolve(0),
        redis.get(lastSeenKey(userId))
      ]);

      const lastSeenTs = lastSeen ? Number(lastSeen) : null;
      const isOnline = !!lastSeenTs && (Date.now() - lastSeenTs) < ONLINE_THRESHOLD_MS;

      return res.json({
        success: true,
        followerCount: followerCount || 0,
        followingCount: followingCount || 0,
        isFollowing: !!isFollowing,
        isSelf: viewerId === userId,
        isOnline,
        lastSeen: lastSeenTs
      });
    } catch (error) {
      console.error('❌ Follow status error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'heartbeat') {
    // ===== POST /api/v1/social/heartbeat =====
    // Dipanggil berkala dari client selagi user buka aplikasi, buat nandain
    // dia lagi online. Gak ada body diperlukan, cukup cookie token.
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = verifyUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }
      const now = Date.now();
      await redis.set(lastSeenKey(userId), now);
      return res.json({ success: true, lastSeen: now });
    } catch (error) {
      console.error('❌ Heartbeat error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'view') {
    // ===== POST /api/v1/social/view { targetUserId } =====
    // Dicatat setiap kali seseorang membuka halaman profil user lain, buat
    // fitur "siapa yang liat profil aku".
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const viewerId = verifyUserId(req);
      if (!viewerId) {
        return res.status(401).json({ error: 'Kamu harus login dulu' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const targetUserId = body?.targetUserId;
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId wajib diisi' });
      }

      // Gak perlu nyatet kalau liat profil sendiri
      if (targetUserId === viewerId) {
        return res.json({ success: true, recorded: false });
      }

      const key = profileViewsKey(targetUserId);
      await redis.zadd(key, { score: Date.now(), member: viewerId });
      // Buang entri paling lama kalau udah kelewat batas
      const total = await redis.zcard(key);
      if (total > MAX_PROFILE_VIEWS) {
        await redis.zremrangebyrank(key, 0, total - MAX_PROFILE_VIEWS - 1);
      }

      return res.json({ success: true, recorded: true });
    } catch (error) {
      console.error('❌ Record profile view error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'viewers') {
    // ===== GET /api/v1/social/viewers?userId=X =====
    // Cuma pemilik profil yang boleh liat daftar ini (privasi).
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const viewerId = verifyUserId(req);
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'userId wajib diisi' });
      }
      if (!viewerId || viewerId !== userId) {
        return res.status(403).json({ error: 'Kamu cuma bisa liat daftar viewer profil sendiri' });
      }

      const key = profileViewsKey(userId);
      const total = (await redis.zcard(key)) || 0;
      // Ambil yang paling baru dulu, maksimal 50
      const raw = (await redis.zrange(key, 0, 49, { rev: true, withScores: true })) || [];

      const ids = [];
      const scoreById = {};
      for (let i = 0; i < raw.length; i += 2) {
        const memberId = raw[i];
        const score = raw[i + 1];
        ids.push(memberId);
        scoreById[memberId] = Number(score);
      }

      const profiles = await publicProfiles(ids);
      const users = profiles
        .map((u) => ({ ...u, viewedAt: scoreById[u.id] || null }))
        .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0));

      return res.json({ success: true, users, total });
    } catch (error) {
      console.error('❌ Profile viewers list error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (action === 'followers' || action === 'following') {
    // ===== GET /api/v1/social/followers|following?userId=X =====
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'userId wajib diisi' });
      }
      const key = action === 'followers' ? followersKey(userId) : followingKey(userId);
      const ids = (await redis.smembers(key)) || [];
      const users = await publicProfiles(ids);
      return res.json({ success: true, users, total: ids.length });
    } catch (error) {
      console.error('❌ Followers/following list error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(404).json({ error: 'Unknown action' });
  }
}
