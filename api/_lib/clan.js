// ===== SISTEM CLAN (marga/guild sosial) =====
// Beda dari GUILDS di rpg.js (yang cuma 4 faksi tetap ala Boss Event), Clan di
// sini adalah grup buatan user sendiri: bisa dibuat, punya role, treasury,
// chat sendiri, dan naik level dari kontribusi member (nonton/baca yang bikin
// akun mereka naik level otomatis nyumbang XP clan, tanpa perlu nyentuh
// endpoint lain yang udah ngasih XP akun -- disinkron "malas" / lazy-sync,
// lihat syncMemberContribution() di bawah).
//
// Redis keys:
//   clan:{id}                  -> STRING JSON record clan (lihat defaultClan())
//   clan:all                   -> ZSET member=clanId score=xp (buat browse/rank)
//   clan:names                 -> HASH nameLower -> clanId (cek nama unik)
//   clan:tags                  -> HASH tagUpper  -> clanId (cek tag unik)
//   clan:members:{id}          -> HASH userId -> JSON {role, joinedAt, xpContributed, xpDonated, lastSyncedWatchTime}
//   clan:userClan:{userId}     -> STRING clanId (lookup cepat "user ini di clan mana")
//   clan:requests:{id}         -> HASH userId -> JSON {requestedAt}
//   clan:invites:{id}          -> HASH userId -> JSON {invitedAt, invitedBy}
//   clan:userInvites:{userId}  -> SET clanId (inbox invite user)
//   clan:dailyClaim:{id}:{uid} -> '1' dengan TTL sampai akhir hari WIB
//   clan:giveExpCd:{userId}    -> '1' dengan TTL 24 jam
//   clan:chat:{id}             -> LIST JSON pesan (lpush, terbaru di depan)
//
// Kita SENGAJA gak nyentuh object `user:{id}` sama sekali di sini (cuma baca),
// biar gak ada risiko bentrok/nimpa field lain yang dikelola file-file API lain.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const nowWIB = () => new Date(Date.now() + WIB_OFFSET_MS);
const secondsUntilEndOfDayWIB = () => {
  const wib = nowWIB();
  const end = new Date(wib);
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(60, Math.floor((end - wib) / 1000));
};
// ISO week string stabil (format: YYYY-Www), dipake buat nge-reset Clan Quest
// Mingguan -- sama persis kayak isoWeekStr() di quests.js, disalin lokal di
// sini biar file ini tetap berdiri sendiri (gak nambah dependency silang).
const isoWeekStr = (d = nowWIB()) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// ===== ROLES =====
export const ROLES = ['LEADER', 'VICE', 'ADMIRAL', 'OFFICER', 'MEMBER'];
export const RANK = { LEADER: 4, VICE: 3, ADMIRAL: 2, OFFICER: 1, MEMBER: 0 };
export const ROLE_LABEL = {
  LEADER: 'Leader',
  VICE: 'Vice Leader',
  ADMIRAL: 'Admiral',
  OFFICER: 'Officer',
  MEMBER: 'Member'
};

const canManage = (actorRole, targetRole, minActorRank = RANK.ADMIRAL) =>
  RANK[actorRole] >= minActorRank && RANK[actorRole] > RANK[targetRole];

export const canKick = (actorRole, targetRole) => canManage(actorRole, targetRole, RANK.ADMIRAL);
export const canChangeRole = (actorRole, targetRole, newRole) =>
  RANK[actorRole] >= RANK.VICE && RANK[actorRole] > RANK[targetRole] && RANK[actorRole] > RANK[newRole];
export const canModerateRequests = (actorRole) => RANK[actorRole] >= RANK.OFFICER;
export const canEditClan = (actorRole) => RANK[actorRole] >= RANK.VICE;
export const canGacha = (actorRole) => RANK[actorRole] >= RANK.VICE;
export const canDisband = (actorRole) => actorRole === 'LEADER';
export const canTransfer = (actorRole) => actorRole === 'LEADER';

// ===== ICON / WARNA PILIHAN SAAT BIKIN CLAN =====
export const CLAN_ICONS = ['Shield', 'Swords', 'Flame', 'Waves', 'Leaf', 'Sparkle', 'Crown', 'Skull', 'Star', 'Moon'];
export const CLAN_COLORS = ['#d4a73c', '#e5484d', '#4f9df5', '#3ecf8e', '#b57bf5', '#f5a623', '#ec4899', '#22d3ee'];
export const CLAN_FRAMES = ['ring', 'double', 'notch', 'dashed', 'glow'];
const MOTD_MAX_LEN = 200;
const TITLE_MAX_LEN = 20;

// ===== LEVEL / KAPASITAS / REWARD CURVE =====
// Sengaja TANPA batas atas -- clan level bisa terus naik gak peduli
// sebesar apa pun XP yang kekumpul (dulu ke-cap di level 40 dan bikin
// progress bar keitung salah kayak "576095109/1").
export const xpForClanLevel = (level) => Math.round(2200 * level + 260 * level * level);
export const clanCapacityForLevel = (level) => 12 + level * 3;
export const clanDailyXpReward = (level) => 35 + level * 12;

export const clanLevelFromXp = (xp) => {
  if (xp <= 0) return 1;
  // Tebakan awal pake rumus kuadrat biar gak looping jutaan kali buat XP raksasa,
  // baru dirapiin +/- beberapa langkah buat kompensasi pembulatan Math.round di atas.
  let level = Math.max(1, Math.floor((-2200 + Math.sqrt(2200 * 2200 + 4 * 260 * xp)) / (2 * 260)));
  while (xp >= xpForClanLevel(level)) level++;
  while (level > 1 && xp < xpForClanLevel(level - 1)) level--;
  return level;
};
export const clanXpProgress = (xp) => {
  const level = clanLevelFromXp(xp);
  const floor = level === 1 ? 0 : xpForClanLevel(level - 1);
  const ceil = xpForClanLevel(level);
  return { level, floor, ceil, current: xp - floor, needed: Math.max(1, ceil - floor) };
};

// Berapa banyak "watchTime" (XP akun) member -> berapa clan XP
const CONTRIBUTION_RATE = 0.06;

// ===== GACHA POOL (banner & warna clan) =====
// Banner sekarang beneran gambar waifu (bukan gradient polos), dibagi 5 tier:
// normal, rare, epic, legendary, mythic -- makin tinggi tier makin langka.
export const GACHA_COST = 1200; // diambil dari treasury clan

const WAIFU_BANNER_URLS = [
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4061.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3559.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6415.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6954.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2493.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2544.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8098.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3654.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1684.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7789.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1079.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/659.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4849.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2286.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4069.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1534.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/41.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4040.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7268.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7212.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1185.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6021.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3890.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6981.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6923.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2978.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3316.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7270.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6458.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2226.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7491.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1365.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6758.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3727.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6990.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1734.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3542.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5470.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/89.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8079.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6488.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1501.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6258.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7367.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1721.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7398.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7311.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1039.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3324.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7677.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7617.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3079.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7601.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3086.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5467.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1680.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4916.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1316.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4801.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4011.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8303.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/582.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3516.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4195.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3651.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4513.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7853.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7471.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7583.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7782.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/887.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2601.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6529.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7312.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6429.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4327.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2336.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3763.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2573.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6568.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6575.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7101.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7922.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7925.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7056.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4305.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4118.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6432.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5939.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7213.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/942.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6816.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/808.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2554.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7822.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/741.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7579.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5438.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6300.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7889.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/962.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7406.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2009.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6719.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6890.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1952.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1246.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6768.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/595.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7038.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6364.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2278.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5984.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8267.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2861.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6397.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/856.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8487.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7756.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1201.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4076.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6587.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3726.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7809.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/822.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6878.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8328.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6262.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6875.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1141.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1953.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7870.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4484.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6218.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3341.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7566.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2056.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2844.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7560.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1410.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7041.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2151.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6681.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7411.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4862.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2972.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2556.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7060.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2331.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7636.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4056.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2750.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/427.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6444.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/598.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/688.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/354.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4248.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6476.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/169.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3550.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6957.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3423.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7421.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6664.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3345.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7346.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6986.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3386.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6031.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4244.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6966.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5985.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/977.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/29.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6787.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2013.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1429.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6549.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4214.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7869.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6804.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2185.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/301.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/240.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1775.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2208.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2980.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3258.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/28.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1395.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4065.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3805.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1602.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6114.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4465.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4518.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4289.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3115.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7890.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7884.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4664.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3148.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1972.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7905.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4294.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/33.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1662.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6967.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6730.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5916.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2054.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4784.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3083.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7858.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7625.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1620.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8063.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7455.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6271.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6248.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5938.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3706.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2564.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1055.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/626.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8178.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/183.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3173.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4653.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8540.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7416.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/903.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/368.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8014.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6194.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/122.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2988.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1588.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2028.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2266.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6634.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7743.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3111.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8505.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4232.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2739.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/173.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3289.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/324.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3291.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8484.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6911.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4663.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1735.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/44.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4370.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3352.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7603.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3615.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2201.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1420.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7248.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6379.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/80.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2181.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2575.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7653.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4376.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7191.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1298.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2599.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4580.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6152.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8538.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7085.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1708.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/407.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2956.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3311.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6618.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3187.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1351.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1345.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/721.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7754.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7708.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4549.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2781.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7375.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3409.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2206.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4440.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3259.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4436.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7343.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2517.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8482.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5532.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4640.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2676.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2390.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5859.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2132.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7575.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/239.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1739.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3905.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2992.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1459.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6138.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2274.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7806.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6650.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3810.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7650.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1237.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7003.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6151.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4064.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1360.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3424.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6997.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2874.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3648.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8270.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7033.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2204.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2033.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1907.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6276.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8004.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2417.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4754.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3486.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1700.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/666.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6813.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1654.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3848.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7727.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3076.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1812.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4524.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6862.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4312.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2755.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/153.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1834.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4354.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1133.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4215.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6654.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6528.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7582.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4910.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3306.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1492.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7827.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2157.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2692.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6815.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/749.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3064.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4586.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1946.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5838.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7814.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6185.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6772.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4596.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2817.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7733.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/590.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5468.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3839.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5942.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2496.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/524.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3961.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2609.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5397.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2122.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4742.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2366.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2752.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5391.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6133.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/199.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2255.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4474.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7639.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4279.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3146.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2590.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3537.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7676.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2552.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7235.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/713.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8105.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5471.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3846.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/463.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3614.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/388.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6764.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7371.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2607.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6794.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6106.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/645.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7079.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3169.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5568.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3405.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7494.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4247.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3609.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1415.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6991.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6200.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5557.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6578.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7066.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7611.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8296.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6928.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2038.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2133.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4491.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2906.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5961.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4573.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2645.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3053.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8053.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1326.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2859.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4142.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7277.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4423.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4547.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4693.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1180.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/501.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6970.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7206.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7484.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6291.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7692.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7251.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3957.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1530.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7354.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6394.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1722.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4558.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3458.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2842.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7913.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7351.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2503.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6015.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6599.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1939.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2697.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6018.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8129.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2622.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3853.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2180.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4363.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2325.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1765.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/193.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3572.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2740.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3184.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5923.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4856.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1653.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6131.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1424.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8316.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1009.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/442.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3758.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4047.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1900.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/719.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5510.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7854.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6662.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2000.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8223.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7062.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2376.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2277.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5857.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3931.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1951.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6084.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1195.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6684.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5398.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/916.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1930.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6544.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6834.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2200.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3371.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7726.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5933.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/123.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/656.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4575.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8543.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4159.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8376.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4635.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7843.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7810.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1704.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6901.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2249.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1293.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7347.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8269.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7716.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3135.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6750.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1986.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6146.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3279.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3344.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4119.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2827.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7120.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3902.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1774.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2144.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7107.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6249.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6906.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6280.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7899.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/330.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2777.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1984.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2749.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8175.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8020.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1710.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5940.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4154.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2237.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7077.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6792.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6278.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6941.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3792.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1069.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6275.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2722.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/520.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3225.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4891.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6876.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3834.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1838.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2477.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7410.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4680.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3561.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7282.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3930.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8107.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7799.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4100.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3694.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3623.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2043.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6829.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1944.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6302.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4543.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7826.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1583.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/685.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1457.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2223.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6858.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4630.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5060.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/768.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/299.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6835.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7807.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/288.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8171.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5577.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1577.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7523.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7059.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1202.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6481.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6572.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3015.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7209.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7470.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7937.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8174.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4379.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3998.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2307.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7700.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7544.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6806.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4638.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4238.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8454.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6893.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/811.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3130.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2412.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7784.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1333.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/505.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2709.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3789.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4171.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7391.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4548.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6947.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7505.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6840.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1648.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7790.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6595.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7095.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7302.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3794.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1337.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/758.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2053.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/443.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1690.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6176.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4715.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7852.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4922.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6678.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5507.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3575.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4880.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6215.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5543.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4284.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1393.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2888.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2230.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6541.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4096.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2306.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2853.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7224.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6888.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6040.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2136.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7571.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3616.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7935.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7715.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1274.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3165.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2825.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6256.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7620.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2991.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3126.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2929.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3335.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2647.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3327.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5421.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5833.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4590.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5502.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1236.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6943.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3310.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2051.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4913.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1287.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4196.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4899.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/603.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3949.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4333.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/854.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2924.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6508.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7689.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5411.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4669.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2267.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4489.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1835.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3749.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2990.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2851.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7887.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6282.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/217.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2471.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/485.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6111.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2592.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4194.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7331.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/476.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8036.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3158.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2409.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/304.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/853.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4691.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1181.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6585.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6229.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5420.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7678.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2808.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/389.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3505.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2883.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7335.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4738.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3753.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4362.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3883.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4500.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6607.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7660.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2016.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4521.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4273.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7546.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7602.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2949.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7798.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7048.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2779.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1179.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3319.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3118.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/548.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7998.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2594.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/904.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2546.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5461.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4058.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/979.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1003.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5978.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3979.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/334.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4593.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7433.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/81.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2982.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4734.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/55.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4501.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2135.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/793.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2407.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1706.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3719.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2659.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4569.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1705.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7499.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3980.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8377.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7359.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7882.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7626.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7553.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4210.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7043.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3982.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4732.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3657.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1037.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8382.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2860.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3399.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2913.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4371.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7976.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/399.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7309.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3637.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3844.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7288.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/413.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6107.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3349.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3466.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7399.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4330.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2040.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6602.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1047.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2770.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4462.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1451.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/209.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5566.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4488.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7350.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3002.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4785.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6669.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6980.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1895.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7301.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8093.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7666.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3112.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5967.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7067.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7377.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1517.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6078.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4522.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2538.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/156.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1462.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3236.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/876.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4574.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4581.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7319.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6765.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2175.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1844.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1310.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7420.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2227.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4144.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2301.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/272.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6219.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6183.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6460.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2480.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6221.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2111.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6930.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6999.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6592.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7989.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1340.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7865.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6960.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7126.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5393.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3384.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3439.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/48.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2735.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2698.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/46.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3544.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7769.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1776.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6177.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8476.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2560.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1886.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2815.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1513.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6739.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3313.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6824.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2531.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3022.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1807.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8161.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5930.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7357.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6601.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7638.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2707.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1557.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1675.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4999.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1752.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3460.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4652.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7805.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6456.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/370.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/317.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6796.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/318.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/913.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3777.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3782.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7875.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1772.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3597.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/62.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6127.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6670.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7751.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6468.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7415.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2819.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6741.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3456.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2837.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7435.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4516.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5516.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7562.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6430.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3026.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4340.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1109.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3865.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5846.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1670.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2664.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1460.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6174.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/801.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/314.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7820.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3121.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3911.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7856.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7203.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4029.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/748.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/802.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8158.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2685.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4808.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8061.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1036.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2419.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1255.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7323.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4783.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/319.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1414.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/136.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4071.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8231.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/338.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6992.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6882.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3661.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4490.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5058.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6929.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2743.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2539.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2472.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2855.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1404.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2311.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3009.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8015.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/75.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4122.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3966.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6500.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7304.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/918.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3043.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4492.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1473.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6265.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3665.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4815.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/348.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6894.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4283.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3556.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6613.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7285.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7090.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/769.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3560.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6726.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2818.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6938.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5046.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7558.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2353.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6580.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6576.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2469.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4911.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/205.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1508.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6861.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2314.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1879.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7245.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4629.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/435.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4835.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3010.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4624.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4438.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2177.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7305.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5943.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6975.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1615.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2202.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7778.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8250.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2032.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2463.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3700.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7496.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1449.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1935.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2965.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1977.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6268.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7497.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/967.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3040.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3078.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4681.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7113.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3959.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1409.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2330.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4446.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/831.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3049.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2182.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1248.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7718.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1582.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4337.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/172.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3770.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2714.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1260.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/892.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/630.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2270.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5047.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8489.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3147.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3093.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6644.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6445.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6168.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5902.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2408.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4434.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4105.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6246.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3986.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1810.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7417.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7097.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6666.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2481.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1707.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3491.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6349.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7369.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6062.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6879.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6913.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/591.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1227.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7527.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3703.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6995.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/614.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6802.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4555.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2087.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7510.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7528.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/347.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3836.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1796.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5982.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7786.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2269.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7699.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4390.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6926.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7623.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3109.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5868.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/398.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4507.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6817.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6973.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2428.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7231.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1579.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6473.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7407.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1686.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5448.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/422.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3410.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2881.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4898.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6715.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4885.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7599.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/813.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7032.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7382.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5435.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2302.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4685.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1121.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3697.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3024.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1697.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3357.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2305.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/926.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3232.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5019.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6037.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3640.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3983.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6306.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/633.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4768.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6531.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7424.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2774.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1052.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8304.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1744.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7612.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1091.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2977.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3920.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3436.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3181.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6891.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3228.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1764.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7521.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7324.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8356.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4006.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4094.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1947.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6128.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4689.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6410.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4249.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3578.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2830.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4601.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8539.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6557.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1256.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/491.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/985.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4242.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1259.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6530.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6155.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7412.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/994.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7005.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6727.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4658.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/602.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4960.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7322.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6236.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7641.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6769.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/530.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7815.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3589.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7725.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1392.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7443.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3051.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/875.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2232.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8006.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6416.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3454.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7356.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3755.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/641.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2508.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/956.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4138.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4529.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4882.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/858.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5395.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3305.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2168.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1628.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8019.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1138.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1286.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2939.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6067.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1018.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3286.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4395.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6605.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2348.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4009.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6396.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5845.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7387.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/51.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3471.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6579.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2205.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4198.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7469.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7597.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4355.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3039.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1108.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1013.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7668.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3188.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1660.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2903.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7314.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5898.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5042.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7531.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1503.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5991.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/559.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5573.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/65.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/618.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1532.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8097.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7244.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2488.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6869.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/118.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3526.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6685.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3579.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6244.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7825.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6880.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/215.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1645.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7011.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1877.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3151.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2251.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1569.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2080.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2877.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2708.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2455.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4025.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4944.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1962.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2092.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3485.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7962.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6968.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7749.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7289.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8022.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2724.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3106.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4165.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2887.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2529.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4996.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6912.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2055.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6886.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4776.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6273.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2346.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4123.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4150.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8355.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2021.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6395.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2976.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3463.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8017.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1320.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3873.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6577.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4884.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4544.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6224.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3733.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/766.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3401.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6640.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2606.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6855.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4251.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/664.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6759.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7556.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4530.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7483.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2534.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3743.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7755.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3029.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/605.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8268.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8350.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7334.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6742.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6939.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/489.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/628.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3482.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/141.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5847.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6147.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4665.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3682.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3161.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1753.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3397.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7861.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6761.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2850.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8068.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8480.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1474.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3233.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7454.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6556.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1837.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/76.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1271.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2863.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4655.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5513.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6139.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6828.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/796.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4841.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2368.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1560.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5433.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3113.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6635.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/730.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/868.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/552.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3276.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6573.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1292.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7520.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3465.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2042.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3864.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1875.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8544.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7298.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3776.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7696.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2761.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7360.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3342.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3968.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1960.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7065.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8317.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6352.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8067.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1896.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5979.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/216.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7429.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8193.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6312.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7013.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5987.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7344.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6235.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4168.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5926.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4499.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7439.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6360.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7386.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7310.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2904.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2024.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7610.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1448.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7329.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4866.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2792.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6933.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1257.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6641.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1066.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/281.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7719.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1418.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2321.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3462.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6082.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2967.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6645.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/560.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5958.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2422.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8341.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6680.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6961.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4632.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4607.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7238.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5016.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3511.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8021.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2091.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5950.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7841.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7635.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7538.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6175.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7914.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4348.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3416.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7064.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5571.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2257.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2212.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8499.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6565.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2941.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7717.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/127.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4427.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8001.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7757.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/358.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4108.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4538.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7561.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/325.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6417.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6872.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5493.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6633.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6983.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7273.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3372.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7682.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3705.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6728.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2094.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2149.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/151.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6807.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/518.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4662.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6308.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1566.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7618.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/869.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7873.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2767.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4111.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2530.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/478.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/264.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8181.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/576.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6405.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2521.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1827.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4028.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6673.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2447.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7585.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3939.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5021.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7480.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3793.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3378.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/403.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2727.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8091.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4670.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1813.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4561.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6617.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7823.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4647.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7931.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/25.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6860.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7345.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/970.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7665.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2687.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7254.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6889.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7395.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7122.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6328.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1225.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6089.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6953.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1335.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5048.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6483.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/31.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3664.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8104.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1638.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6790.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3837.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3084.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4140.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2101.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7459.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/84.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7481.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8381.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6707.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1852.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1943.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7868.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6710.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6398.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7007.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4619.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1552.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/901.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7290.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7576.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2258.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1803.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1092.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4032.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1145.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1967.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6130.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6057.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3320.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2424.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6784.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3379.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8046.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2022.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6766.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3329.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8284.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7215.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2810.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6165.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2994.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4329.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1724.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2684.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8385.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7125.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6736.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3856.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2839.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5914.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/759.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5465.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7991.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7518.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6677.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3720.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/706.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1342.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6422.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3288.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3904.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4203.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5043.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4892.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4211.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2470.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4292.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6898.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3159.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7779.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4315.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/774.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6621.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4027.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/265.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2265.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1819.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/227.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3218.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2098.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/374.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4260.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/168.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6286.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/976.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2620.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6899.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2603.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7221.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2600.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/555.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3055.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8123.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4373.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4912.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7900.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4599.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6076.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5906.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3087.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/250.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7878.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3546.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2656.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/950.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7087.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3840.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/587.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2663.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4167.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/593.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7892.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6971.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1057.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5458.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7121.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6172.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5405.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7501.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1551.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2343.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6745.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6406.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3400.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6594.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1282.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6609.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3244.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7734.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/329.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4554.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1831.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2923.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7256.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4411.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6266.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6921.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/623.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6113.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2736.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/899.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6413.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1041.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4551.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6158.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1671.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7804.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3724.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5474.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2557.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2821.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6786.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2826.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1893.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6951.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6837.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2139.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7328.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7103.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7871.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7591.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6213.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3684.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/525.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3284.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8542.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6927.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/883.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1258.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7565.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3240.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5832.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3981.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/526.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7910.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3757.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2081.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7246.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1118.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3653.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3498.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/201.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1901.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3709.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3796.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/121.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7294.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4218.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7105.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7392.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3553.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3037.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3418.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3048.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8062.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7096.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1541.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6596.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1910.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5426.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6643.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5976.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6788.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8305.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7906.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4559.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6791.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7673.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1677.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2505.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4112.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3764.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8339.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3050.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1212.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3830.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1334.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1823.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3903.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1647.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1124.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2254.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2328.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4074.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7464.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1632.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4170.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/931.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8024.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7457.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4576.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/756.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1366.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/843.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1991.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7885.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3167.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/210.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2310.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6050.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7419.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3127.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7295.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/968.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7223.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6978.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4326.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3524.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7355.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1958.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4208.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4175.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3432.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3567.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6245.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1990.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4963.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3929.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6892.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1381.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3812.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2085.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7936.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4567.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6865.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7261.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5544.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6129.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7300.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7519.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2337.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7504.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3785.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8307.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3292.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6299.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2156.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1970.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7693.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3850.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7316.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7720.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4597.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4772.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5552.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1676.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4550.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7686.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4460.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6660.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1175.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5496.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3658.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2449.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1841.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4467.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4143.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6571.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6124.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6272.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4688.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1673.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6385.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6831.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7584.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2425.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7535.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3061.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4933.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2921.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7824.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3907.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3157.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6945.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/550.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7259.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5920.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8013.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4756.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7250.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3052.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3973.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4145.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3787.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5949.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4512.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2276.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6919.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7828.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3377.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2731.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4035.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7370.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1011.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3530.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1375.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7670.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3042.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2089.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5993.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6763.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1446.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6682.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3129.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6805.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2086.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3969.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7313.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7229.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6043.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1065.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7637.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/800.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7131.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2363.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1998.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3478.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2214.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7684.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5965.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2927.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5837.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/737.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4468.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7001.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4228.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6868.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/700.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8000.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7534.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7076.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4221.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2473.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7924.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3137.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1277.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8280.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4073.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6864.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3008.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5973.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2931.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6694.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7761.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7409.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1518.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/359.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1595.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5896.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6426.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4115.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1085.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/859.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4202.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3513.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1319.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7545.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6998.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6097.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7124.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6902.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3551.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/24.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3545.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7317.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4043.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7482.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/380.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7243.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8272.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4570.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7332.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/401.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7495.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7701.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6962.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1981.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5917.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5511.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1357.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6760.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4508.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2007.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1656.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3217.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7054.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7713.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4514.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7758.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/972.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/160.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6735.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1288.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6414.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2593.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3900.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7901.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7877.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2261.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1872.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2075.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5951.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7002.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1601.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5451.webp",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1425.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4461.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6623.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2385.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2814.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3264.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2518.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7621.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2968.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7879.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/629.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/823.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/161.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3472.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1095.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3667.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3852.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1668.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1083.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1099.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/783.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5893.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5531.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4867.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8103.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8094.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3879.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3092.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7568.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/405.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7393.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2729.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8042.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/908.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7366.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6449.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1113.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7872.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7648.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3970.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6949.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6228.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5559.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1267.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2528.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1787.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1470.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7802.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1454.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2566.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/415.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3368.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4291.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5970.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7613.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/456.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6767.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/867.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4429.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4612.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3558.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2785.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3396.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/929.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7339.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6462.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4471.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6356.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2572.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5497.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6264.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8498.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1230.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/430.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1809.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3509.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5992.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7808.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6263.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2093.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3475.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1403.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7735.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/71.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2373.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1777.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5852.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6412.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7297.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7118.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8546.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2088.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5059.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3870.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1207.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3732.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/280.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1172.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1146.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2959.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8375.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6866.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8130.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4556.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7526.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1811.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6482.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4062.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2780.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5038.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2908.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2369.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7320.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3619.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5403.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7082.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6597.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2618.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7891.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4969.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7218.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1269.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1997.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7444.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7898.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7403.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7093.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7690.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2354.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1963.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2386.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7787.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/814.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3351.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2905.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3098.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3281.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3019.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3838.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4943.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1190.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6586.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4059.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7373.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/698.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1771.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1264.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7384.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1525.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/678.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1996.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4288.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8537.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1152.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6537.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4840.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4744.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4334.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6979.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4258.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/79.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2673.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7364.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1094.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8565.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7049.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7422.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6651.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3034.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6182.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3772.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7462.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6231.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6448.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7932.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6197.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1537.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3557.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5897.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7631.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/12.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1249.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7431.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6606.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7129.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8157.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3391.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2125.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2608.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4847.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1618.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7977.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7092.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6464.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4729.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3464.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7010.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5064.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3361.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1658.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8364.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6925.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4107.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2782.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6732.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4026.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8059.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2547.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3752.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2420.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2381.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1211.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2794.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5983.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3427.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1545.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/302.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3750.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7698.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/480.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7619.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6148.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2334.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1273.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4479.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6896.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6598.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4657.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3047.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7908.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5569.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3802.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7588.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7640.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8325.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6972.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6839.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3430.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/131.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1114.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/840.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2203.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3935.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4174.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1633.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1240.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/279.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/844.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6171.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5900.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6841.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4110.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2983.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7920.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3647.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7280.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4610.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7609.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4893.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/542.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/809.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7061.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1527.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6442.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/775.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3119.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1756.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6238.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/600.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2943.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1304.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/958.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/448.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7447.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8306.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7031.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7921.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1733.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/818.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4636.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1063.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3451.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7396.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4823.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4234.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2642.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6055.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6166.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2541.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4125.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7239.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1567.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4068.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7912.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1089.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2803.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7550.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3740.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1688.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1950.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/444.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7365.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6434.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/513.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1979.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1698.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3168.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1897.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7685.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7975.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6071.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7418.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8257.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3245.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7581.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1824.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7128.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3476.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6733.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1978.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6347.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6494.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2922.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7916.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/109.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1276.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4187.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3686.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7982.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1022.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2506.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1885.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/648.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1389.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1062.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7362.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6948.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4257.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/886.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4578.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3204.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6918.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1528.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6574.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5425.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3814.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4525.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2394.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1481.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7630.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7119.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4380.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/176.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3404.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3896.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4617.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3807.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1914.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7918.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3011.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/189.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1343.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8344.webp",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/179.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/669.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7574.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3231.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4183.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2970.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7866.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6310.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2112.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6538.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2542.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2012.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1931.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7664.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3826.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4401.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6470.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/850.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6647.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6793.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1769.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6407.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7052.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1531.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4092.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7883.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3938.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6826.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3887.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1711.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6653.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4822.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8380.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4792.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2764.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/88.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2436.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5427.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8110.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2128.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4517.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3841.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7044.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4435.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7275.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7667.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2680.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7509.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6884.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/517.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1540.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3748.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3806.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7656.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1061.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6851.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1694.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2351.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3766.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4394.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2778.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7783.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6217.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1071.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2561.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3512.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7114.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4133.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1399.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6226.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1770.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3857.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1766.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1306.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7642.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3338.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7240.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8106.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3737.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2510.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8165.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7572.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4000.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/220.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/484.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1723.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6714.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3414.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3271.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3141.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3680.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7547.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6591.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6857.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4151.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5535.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7655.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4226.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/20.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3977.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6743.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/287.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8043.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6369.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6173.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4645.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7573.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/237.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1027.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1311.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3582.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7100.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2945.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3692.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6045.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/911.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7383.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/305.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1155.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3779.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2917.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3346.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1073.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1730.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1805.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2367.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2335.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8156.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4212.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/770.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2159.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4536.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/955.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5041.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/753.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2614.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3501.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3099.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1878.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1642.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2725.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4737.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4250.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8488.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5548.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1536.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6100.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5962.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8172.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5469.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4038.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2113.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/695.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2801.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/504.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1147.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2771.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/676.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1681.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7394.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2831.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1017.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5948.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1105.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7205.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2142.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3406.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6989.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6216.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6800.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3160.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/884.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7983.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4622.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3302.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8012.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7473.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5436.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3833.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6797.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6330.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7512.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6423.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3611.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/411.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2178.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6348.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1349.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2876.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2829.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/528.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/893.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4902.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2126.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2293.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3934.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6566.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1867.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/208.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6446.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2796.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1238.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5533.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2565.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4178.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4589.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1359.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6083.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1159.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3252.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2579.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/888.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6212.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2076.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6420.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8051.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3300.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2694.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2238.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/829.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8069.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6877.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/754.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6418.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7741.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2947.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/174.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5473.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6368.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5929.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/309.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6203.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5835.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6443.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1101.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3467.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2326.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7846.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6588.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1543.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5944.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1450.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/383.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2966.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2415.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3067.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5456.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1606.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3457.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6188.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6372.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7487.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7748.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/349.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/197.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4579.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6774.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8071.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6345.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4770.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1982.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6072.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6022.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1562.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1699.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4651.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6075.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2773.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4450.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3263.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6108.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4349.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/438.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3791.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1683.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2209.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6956.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6608.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4285.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3927.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8100.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3477.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1407.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8478.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1882.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7202.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2890.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8070.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8496.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/761.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1317.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/300.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1999.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2577.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1859.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7475.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3718.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1187.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7104.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4199.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5547.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4873.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4928.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4546.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7479.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7117.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6225.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6649.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2342.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3956.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6734.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4153.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5495.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2062.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7466.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4975.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2807.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/426.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7130.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4217.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2617.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4979.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3668.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6914.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1535.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5575.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5014.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6327.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6931.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4407.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5877.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7453.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/365.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1302.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5010.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1323.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2148.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6140.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/409.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4192.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2445.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5563.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3666.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3116.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7675.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/460.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4082.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7606.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2361.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1219.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4352.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8357.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7242.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7744.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1726.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6683.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2155.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2220.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4409.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7427.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7434.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6812.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2919.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3984.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6137.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2900.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7338.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7803.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6569.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1495.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6099.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6452.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4666.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2083.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2963.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/986.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/762.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3676.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7795.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/732.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7467.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/949.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4252.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4015.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2332.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/898.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7460.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7401.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7307.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6560.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5953.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3193.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6459.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2389.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6196.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6854.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7127.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6162.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/129.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2549.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8066.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4806.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3528.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5894.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1218.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1506.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6399.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7219.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3046.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3069.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7792.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2616.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3012.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7541.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4677.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2880.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2751.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1650.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7075.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6581.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/191.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2987.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4668.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7046.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7318.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7911.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3828.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1428.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4627.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4459.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6897.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3534.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2670.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4431.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4079.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/997.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2636.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5565.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/387.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5013.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1490.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1056.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/606.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4321.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4350.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6942.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7507.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6370.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8065.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2362.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/714.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/819.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6976.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7451.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3254.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8016.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1019.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1012.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6836.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/66.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7081.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6844.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2748.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1131.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4683.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1521.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2173.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8173.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7296.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6871.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3104.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1072.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4254.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/862.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3573.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4377.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/113.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1291.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/83.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4262.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5422.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3006.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3085.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/881.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7537.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2352.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1974.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2791.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8101.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4498.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2638.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6754.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8308.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7990.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4503.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5400.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6744.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/878.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6965.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4634.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2344.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3214.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7267.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3908.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6982.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3307.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6729.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1243.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3490.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7969.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7428.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/236.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4953.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6852.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7449.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2145.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2421.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6711.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7452.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6814.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7271.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8383.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3201.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/395.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7279.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/67.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3358.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2215.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8111.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1416.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1162.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1565.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/832.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3388.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2431.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3891.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7559.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6117.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1442.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6485.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/533.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7486.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3229.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3256.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6718.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2699.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3541.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7089.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1909.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8372.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4442.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7269.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7923.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7432.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1613.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6187.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4456.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4358.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2938.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1232.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6712.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1270.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6255.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2196.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2239.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6472.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8497.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/672.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4270.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/339.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/729.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7746.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1640.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6390.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1308.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1132.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7963.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3531.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1911.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1384.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7448.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6475.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/158.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6283.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1244.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3070.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6227.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4412.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6103.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6554.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5567.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2705.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7594.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3101.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6409.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6329.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1455.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4864.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1892.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4256.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7919.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/777.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3587.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6024.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5464.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1858.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7000.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7437.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4995.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/568.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6916.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2932.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6713.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/40.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3889.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7651.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2049.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7423.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1961.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/477.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8384.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7590.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2652.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7801.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1386.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7817.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6637.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4527.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2846.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3425.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8479.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7669.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3483.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7058.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7649.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1082.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/866.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7511.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1631.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6688.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3858.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8509.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2955.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/946.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4245.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1725.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/922.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3199.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2405.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4469.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3644.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6169.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/857.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6903.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2483.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8095.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7333.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7463.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5462.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7939.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7652.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1064.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2494.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1649.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4322.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6987.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6101.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/828.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2072.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4495.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6153.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2006.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6011.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7688.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2717.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2649.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2516.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4414.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8340.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2632.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/10.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/728.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3798.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2650.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3877.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1760.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3100.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5964.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3186.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4084.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1068.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2662.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5925.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7072.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2823.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6359.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1731.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7785.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3297.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2003.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6201.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8545.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6199.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3884.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2523.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4066.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1989.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2500.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4241.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1751.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3921.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4929.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7234.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1696.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1123.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6838.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5995.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7004.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4740.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/56.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4649.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2005.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/653.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7554.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7933.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3784.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3601.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8162.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5026.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1679.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4557.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6619.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5432.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/991.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2784.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7577.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7274.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8483.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2466.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/377.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4553.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4455.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1176.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4243.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1520.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7363.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6427.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7515.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2011.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1762.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4894.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4004.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5957.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1589.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/436.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7508.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4307.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4184.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6738.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1050.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2246.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3606.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7299.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6191.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/234.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1912.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7860.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2813.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3403.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1266.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2769.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/110.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1546.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3205.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6195.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6963.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3932.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5990.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/262.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1217.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4646.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5417.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2519.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7893.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4306.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6123.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2186.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4865.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7567.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/563.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4189.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/277.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7402.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4180.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7441.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6915.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4888.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8516.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2775.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2957.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2866.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6477.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6751.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1430.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4052.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2439.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1171.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3266.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/119.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7874.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4824.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4564.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7529.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/896.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5463.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6365.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1160.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1727.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2349.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3878.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2753.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4828.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6646.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1157.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5892.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8251.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3803.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7679.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4918.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6298.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3213.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7697.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2341.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/882.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1368.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5412.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6958.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5440.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7225.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2507.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6803.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7057.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7108.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6091.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6463.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4818.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/116.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1636.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4432.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6392.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/544.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6604.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3518.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5550.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3364.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7376.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1397.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1983.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/838.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7080.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2065.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7385.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3328.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2260.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7074.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8169.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4139.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1985.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/948.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/527.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2284.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5545.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6589.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3350.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6042.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6154.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2940.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8033.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5849.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3645.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2690.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4393.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7552.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/382.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4686.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1370.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3005.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7232.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4031.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6659.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7266.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7461.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7859.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4050.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3196.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6337.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3153.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3387.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/558.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/107.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/226.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5989.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/259.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6493.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7252.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/983.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3829.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6988.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7029.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/969.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/920.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7492.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/342.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5017.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1290.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5538.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6955.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6285.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5954.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4057.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4088.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6189.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7752.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1485.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7934.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6746.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3312.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3762.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5834.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3096.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/90.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1102.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3825.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7658.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6686.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/38.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8002.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7930.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/43.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7600.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/509.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3356.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7578.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2134.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5977.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/284.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7794.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/340.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6260.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3407.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2219.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7476.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2461.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7477.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4679.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7661.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2229.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/73.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4428.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/745.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6419.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4924.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5960.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3248.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1034.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7112.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/117.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7368.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3362.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8032.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3795.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2802.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/767.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2655.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3336.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4116.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3817.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/699.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/963.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/877.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/470.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7629.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1644.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3672.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7863.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1804.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2025.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6424.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7902.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2459.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1467.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/711.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4727.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5966.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3296.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3038.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1553.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3747.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4408.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/795.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5555.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3639.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7886.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7006.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8108.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7337.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7336.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2044.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4730.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1387.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2898.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7405.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3593.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2916.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4927.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1374.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7813.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4353.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5955.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2936.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7207.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3054.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8052.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3317.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3417.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2527.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7687.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7028.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2235.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7864.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3334.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7446.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3175.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2648.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6239.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6940.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7915.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4931.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3824.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1116.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4674.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2944.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5851.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2070.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5561.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1262.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/705.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8495.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6883.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7781.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5899.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6974.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7500.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7204.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5556.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6907.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7458.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4502.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1655.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7750.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4081.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4359.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3539.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6478.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4660.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7379.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3914.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2262.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/546.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5424.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7964.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4078.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1808.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5540.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6281.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7788.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2410.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6874.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5051.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3673.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3036.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/532.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6059.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4643.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7084.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6716.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/337.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8463.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3172.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7099.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7400.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6952.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1825.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2123.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/834.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2610.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1382.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4720.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4441.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8229.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/126.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3373.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4430.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/455.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7525.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7753.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6149.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3722.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3058.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1488.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7542.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6679.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6252.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7580.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2391.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2754.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3584.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6102.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4261.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1471.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/965.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4932.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/148.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3469.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2728.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8168.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2989.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7361.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4675.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/952.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4920.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6303.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1743.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4222.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7039.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/243.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7408.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1564.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3604.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7777.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6277.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6234.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/613.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8249.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1128.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4169.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5886.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3909.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3321.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2822.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2271.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7051.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7780.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3621.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8271.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1692.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4654.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3971.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8023.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4206.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3468.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/803.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1674.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6648.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6753.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2910.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6065.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4481.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6996.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2759.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3166.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1938.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5915.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5445.webp",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2737.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/817.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7438.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5434.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/242.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7857.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6006.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7358.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4803.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6638.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1847.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/437.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2995.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1445.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4099.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2637.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7474.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3646.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/932.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6946.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2768.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6480.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6665.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1550.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3120.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6833.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/307.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8160.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7705.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3847.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2300.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6667.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6936.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4067.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7742.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7714.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/154.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7485.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2545.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2884.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1170.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2242.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1067.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/845.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/252.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6832.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8054.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1826.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6121.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1117.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7589.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7811.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1167.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7907.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4678.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6451.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2894.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2911.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/261.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6993.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3713.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6811.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/273.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1074.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/59.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1754.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4385.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3917.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7053.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2836.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/608.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3499.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6003.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7549.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7094.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7063.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7702.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2244.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6471.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4967.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5843.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6143.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7489.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/60.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/592.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2119.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7342.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/701.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4018.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1499.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3568.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3831.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7672.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1097.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1166.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/586.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2304.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6944.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7390.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/473.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2805.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3446.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3440.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1303.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7490.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3525.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8510.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6977.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/87.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1854.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5972.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7632.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1898.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/223.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2641.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7721.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6116.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8443.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7291.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6184.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4448.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1433.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2374.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8486.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1934.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1134.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7055.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/720.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1203.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/369.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4147.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3278.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3431.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2099.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3827.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7227.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3394.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7909.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/204.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/681.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2162.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3402.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7042.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5928.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7260.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6885.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8034.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4475.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2515.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7586.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/537.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6284.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6699.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8302.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1873.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7283.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6799.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7030.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6922.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3936.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/846.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2895.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6073.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6867.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3267.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3696.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2847.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2571.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4736.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3832.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1980.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7862.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4602.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7008.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6257.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7308.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6469.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6917.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7845.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7050.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5518.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5924.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8037.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7088.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3139.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2121.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4148.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4985.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2795.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8008.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2742.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2790.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1818.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1507.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4223.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2691.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5519.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8293.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/263.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4335.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4163.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3590.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4690.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1741.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7330.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1860.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6109.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3470.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5860.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3760.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7327.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7241.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2535.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6341.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7374.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5558.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/195.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7514.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7797.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6307.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6132.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7844.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2108.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4093.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6110.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7352.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2711.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1781.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7378.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2225.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2411.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3866.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7839.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2303.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/617.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3290.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4552.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3569.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5934.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/646.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6969.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6461.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4466.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6620.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8205.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7430.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3195.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/927.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3365.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1598.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4075.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8109.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/782.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4264.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3206.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7821.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3716.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7768.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/673.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2285.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6358.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3885.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4130.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1801.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8416.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/412.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/267.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4410.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7086.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2793.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8099.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2700.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2217.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3068.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5541.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6122.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3017.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7819.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5907.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8058.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/640.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7111.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8176.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7793.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4347.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6344.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2789.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1432.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1487.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4672.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3638.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/925.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2862.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1747.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7413.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/310.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/11.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5980.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7078.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1080.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4121.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2901.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8155.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6425.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6639.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7272.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2423.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7255.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2150.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1746.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2468.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/733.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3649.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4954.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2165.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6636.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7106.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2602.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2835.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6161.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/394.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/642.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7812.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/827.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2359.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4016.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7083.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7745.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1623.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2682.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3191.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4318.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1341.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6830.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4545.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7276.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2937.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3507.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2984.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6005.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6747.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7445.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6232.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/171.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1866.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/632.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2584.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7321.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1664.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3239.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5986.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1555.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5913.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1426.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1840.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/815.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/35.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8485.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2760.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6789.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7524.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7671.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2233.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/760.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4584.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2153.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/8159.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7657.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7258.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6466.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6994.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7548.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/860.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2623.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3607.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6363.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3251.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7888.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4966.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7281.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3967.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2234.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6801.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2114.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4565.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3632.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4868.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5466.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/400.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5459.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7938.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7315.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7539.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3133.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4303.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1110.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2100.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2964.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7498.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5974.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2925.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6321.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6251.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1183.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1761.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1757.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1107.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1364.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4188.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1353.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7867.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6017.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6070.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4644.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4398.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7894.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2106.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2625.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7035.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7605.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7533.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/507.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6465.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1191.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4671.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3655.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7503.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4726.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/224.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4872.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1524.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2365.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2347.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3627.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5418.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4173.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7349.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4497.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2772.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2395.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2309.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/907.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1136.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/63.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4598.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3013.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7236.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7563.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6223.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6656.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3395.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/343.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2372.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2695.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3150.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3685.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4656.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6214.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5909.gif",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3174.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4993.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6081.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2783.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6616.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1929.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6052.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2946.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7540.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1048.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6144.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1902.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7681.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7587.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1088.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7633.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3510.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2998.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2952.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/2746.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/902.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/458.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4156.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/6845.png",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3835.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7306.jpg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/1075.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3687.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/609.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/4325.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3437.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/3370.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/5910.jpeg",
    "https://raw.githubusercontent.com/andikachan/image_waifu/master/7249.jpg"
  ];
const WAIFU_TIER_RANGES = [
  { tier: 'normal', count: 1517 },
  { tier: 'rare', count: 995 },
  { tier: 'epic', count: 687 },
  { tier: 'legendary', count: 435 },
  { tier: 'mythic', count: 403 }
];
const buildWaifuBanners = () => {
  const banners = [];
  let cursor = 0;
  for (const { tier, count } of WAIFU_TIER_RANGES) {
    for (let i = 0; i < count; i++) {
      const url = WAIFU_BANNER_URLS[cursor];
      if (!url) break;
      banners.push({
        id: `banner_wf${String(cursor + 1).padStart(2, '0')}`,
        type: 'banner',
        name: `Waifu #${cursor + 1}`,
        rarity: tier,
        url
      });
      cursor++;
    }
  }
  return banners;
};

export const GACHA_POOL = buildWaifuBanners();
const RARITY_WEIGHT = { normal: 55, rare: 28, epic: 12, legendary: 4, mythic: 1 };
const RARITY_ORDER = { normal: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
const getGachaItem = (id) => GACHA_POOL.find((i) => i.id === id) || null;

const rollGachaItem = ({ minRarity } = {}) => {
  const pool = minRarity ? GACHA_POOL.filter((i) => RARITY_ORDER[i.rarity] >= RARITY_ORDER[minRarity]) : GACHA_POOL;
  const total = pool.reduce((sum, i) => sum + RARITY_WEIGHT[i.rarity], 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= RARITY_WEIGHT[item.rarity];
    if (roll <= 0) return item;
  }
  return pool[0];
};

// ===== KEY HELPERS =====
const clanKey = (id) => `clan:${id}`;
const membersKey = (id) => `clan:members:${id}`;
const requestsKey = (id) => `clan:requests:${id}`;
const invitesKey = (id) => `clan:invites:${id}`;
const userInvitesKey = (userId) => `clan:userInvites:${userId}`;
const userClanKey = (userId) => `clan:userClan:${userId}`;
const dailyClaimKey = (id, userId) => `clan:dailyClaim:${id}:${userId}`;
const chatKey = (id) => `clan:chat:${id}`;
const activityLogKey = (id) => `clan:activity:${id}`;
const CLAN_RANK_ZSET = 'clan:all';
const NAMES_HASH = 'clan:names';
const TAGS_HASH = 'clan:tags';
const INVITE_CODES_HASH = 'clan:inviteCodes'; // code -> clanId

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter mirip (0/O, 1/I)
function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  return code;
}

const genId = () => `cl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const safeParse = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

// ===== USER HELPERS (read-only) =====
export async function getUser(redis, userId) {
  const raw = await redis.get(`user:${userId}`);
  return safeParse(raw);
}

function publicProfile(userId, u) {
  if (!u) return { id: userId, name: 'User', picture: null, level: 0 };
  return { id: userId, name: u.name || 'User', picture: u.picture || null, level: u.level || 0 };
}

// ===== CLAN RECORD =====
function defaultClan({ id, name, tag, desc, icon, color, joinType, minLevel, leaderId }) {
  return {
    id, name, tag,
    desc: desc || '',
    icon: icon || 'Shield',
    color: color || '#d4a73c',
    banner: null,
    bannerPosition: '50% 50%',
    joinType,
    minLevel: minLevel || 0,
    xp: 0, treasury: 0, shards: 0,
    leaderId, founderId: leaderId, memberCount: 1,
    activeBanner: null,
    unlockedItems: [],
    war: null, warWins: 0, warHistory: [],
    frame: 'ring', motd: null,
    inviteCode: generateInviteCode(),
    createdAt: new Date().toISOString()
  };
}

export async function loadClan(redis, id) {
  if (!id) return null;
  const raw = await redis.get(clanKey(id));
  return safeParse(raw);
}
export async function saveClan(redis, clan) {
  await redis.set(clanKey(clan.id), JSON.stringify(clan));
  await redis.zadd(CLAN_RANK_ZSET, { score: clan.xp, member: clan.id });
}

async function getMemberData(redis, clanId, userId) {
  const raw = await redis.hget(membersKey(clanId), userId);
  return safeParse(raw);
}
async function setMemberData(redis, clanId, userId, data) {
  await redis.hset(membersKey(clanId), { [userId]: JSON.stringify(data) });
}

export async function getUserClanId(redis, userId) {
  return (await redis.get(userClanKey(userId))) || null;
}

// ===== BADGE IDENTITAS (dipakai di chat/komentar/profil di luar halaman Clan) =====
// Badge cuma butuh info ringan: tag, icon, warna aktif, dan level clan.
const toBadge = (clan) => {
  if (!clan) return null;
  return {
    clanId: clan.id,
    name: clan.name,
    tag: clan.tag,
    icon: clan.icon,
    color: clan.color,
    level: clanLevelFromXp(clan.xp)
  };
};

// Ambil badge clan 1 user (buat halaman profil).
export async function getClanBadge(redis, userId) {
  const clanId = await getUserClanId(redis, userId);
  if (!clanId) return null;
  const clan = await loadClan(redis, clanId);
  return toBadge(clan);
}

// Ambil badge clan buat banyak user sekaligus secara efisien (dipakai buat
// nempelin badge ke tiap pesan chat / komentar tanpa N+1 query per item).
export async function attachClanBadges(redis, items, userIdField = 'userId') {
  const list = Array.isArray(items) ? items : [items];
  const userIds = [...new Set(list.map((it) => it?.[userIdField]).filter(Boolean))];
  if (userIds.length === 0) return items;

  const clanIdKeys = userIds.map((id) => userClanKey(id));
  const clanIds = await redis.mget(...clanIdKeys);
  const userToClanId = {};
  const uniqueClanIds = new Set();
  userIds.forEach((uid, i) => {
    if (clanIds[i]) { userToClanId[uid] = clanIds[i]; uniqueClanIds.add(clanIds[i]); }
  });

  if (uniqueClanIds.size === 0) return items;

  const clanIdList = [...uniqueClanIds];
  const clanKeys = clanIdList.map((id) => clanKey(id));
  const clanRaws = await redis.mget(...clanKeys);
  const clanById = {};
  clanIdList.forEach((id, i) => { if (clanRaws[i]) clanById[id] = safeParse(clanRaws[i]); });

  for (const item of list) {
    const uid = item?.[userIdField];
    const cId = uid && userToClanId[uid];
    item.clanBadge = cId ? toBadge(clanById[cId]) : null;
  }
  return items;
}

// ===== CLAN QUEST MINGGUAN =====
// Target XP BARENG-BARENG dari seluruh member, reset tiap minggu (WIB).
// Progressnya numpang di setiap sumber yang nambah clan.xp (kontribusi
// pasif/naik level, Donate EXP, Give EXP) lewat addClanXp() di bawah --
// begitu target kecapai, treasury langsung dapet bonus sekali per minggu.
export const weeklyQuestTarget = (level) => 3000 + level * 400;
export const weeklyQuestReward = (level) => 500 + level * 50;

function addClanXp(clan, amount) {
  if (!(amount > 0)) return;
  clan.xp += amount;

  // Kalau lagi perang, XP yang sama juga jadi skor war (real-time, dari
  // kontribusi member manapun -- nonton/baca, donate, atau give exp).
  if (clan.war && clan.war.status === 'active') {
    clan.war.score = (clan.war.score || 0) + amount;
  }

  const week = isoWeekStr();
  if (clan.weeklyQuestWeek !== week) {
    clan.weeklyQuestWeek = week;
    clan.weeklyQuestProgress = 0;
    clan.weeklyQuestClaimed = false;
  }
  clan.weeklyQuestProgress = (clan.weeklyQuestProgress || 0) + amount;

  const level = clanLevelFromXp(clan.xp);
  const target = weeklyQuestTarget(level);
  if (!clan.weeklyQuestClaimed && clan.weeklyQuestProgress >= target) {
    clan.treasury += weeklyQuestReward(level);
    clan.weeklyQuestClaimed = true;
  }
}

// ===== MILESTONE CLAN =====
// Badge kecil yang nempel begitu clan tembus level tertentu -- murni buat
// gengsi/pencapaian, gak ada efek gameplay.
const MILESTONES = [
  { level: 100, label: 'Legenda', icon: 'Crown' },
  { level: 50, label: 'Elite', icon: 'Star' },
  { level: 25, label: 'Veteran', icon: 'Sparkle' },
  { level: 10, label: 'Perintis', icon: 'Flame' }
];
function clanMilestone(level) {
  return MILESTONES.find((m) => level >= m.level) || null;
}

// ===== LAZY XP SYNC =====
// Dipanggil tiap kali user menyentuh endpoint clan (atau saat clan hall
// dimuat). Bandingin watchTime akun sekarang vs checkpoint terakhir yang
// tersimpan di data member, lalu selisihnya dikonversi jadi clan XP.
// Dengan cara ini kita gak perlu ubah 8+ tempat lain yang ngasih XP akun.
export async function syncMemberContribution(redis, clanId, userId) {
  const [clan, member, user] = await Promise.all([
    loadClan(redis, clanId),
    getMemberData(redis, clanId, userId),
    getUser(redis, userId)
  ]);
  if (!clan || !member || !user) return clan;

  const currentWatch = user.watchTime || 0;
  const last = member.lastSyncedWatchTime ?? currentWatch;
  const delta = currentWatch - last;
  if (delta > 0) {
    const gained = Math.max(0, Math.floor(delta * CONTRIBUTION_RATE));
    if (gained > 0) {
      addClanXp(clan, gained);
      member.xpContributed = (member.xpContributed || 0) + gained;
      await saveClan(redis, clan);
    }
  }
  member.lastSyncedWatchTime = currentWatch;
  await setMemberData(redis, clanId, userId, member);
  return clan;
}

async function syncAllMembers(redis, clanId) {
  const raw = await redis.hgetall(membersKey(clanId));
  const ids = Object.keys(raw || {});
  for (const uid of ids) {
    await syncMemberContribution(redis, clanId, uid);
  }
  return loadClan(redis, clanId);
}

// "Grade" kontribusi member, dipakai buat badge kecil di daftar member.
// Dihitung dari GABUNGAN xpContributed (naik level akun) + xpDonated (Donate
// EXP) -- kalau cuma pake xpContributed doang, member yang kontribusinya
// lewat donate EXP keliatan "0 XP disumbang" terus padahal udah nyumbang banyak.
function memberGrade(total = 0) {
  if (total >= 8000) return 'Diamond';
  if (total >= 3000) return 'Gold';
  if (total >= 800) return 'Silver';
  return 'Bronze';
}

// Title identitas member -- murni gengsi, gak ngaruh ke gameplay. "Founder"
// nempel permanen ke pendiri asli clan (walau udah gak jadi Leader lagi
// karena transfer), "Veteran" nempel begitu udah gabung >= 100 hari.
function memberTitle(uid, joinedAt, clan, customTitle) {
  if (customTitle) return customTitle;
  if (clan.founderId === uid) return 'Founder';
  const days = (Date.now() - new Date(joinedAt).getTime()) / (24 * 60 * 60 * 1000);
  if (days >= 100) return 'Veteran';
  return null;
}

// ===== SHAPE OUTPUT =====
async function shapeClan(redis, clan, { withMembers = false, withRank = false } = {}) {
  const progress = clanXpProgress(clan.xp);
  const out = {
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    desc: clan.desc,
    icon: clan.icon,
    color: clan.color,
    joinType: clan.joinType,
    minLevel: clan.minLevel,
    leaderId: clan.leaderId,
    memberCount: clan.memberCount,
    capacity: clanCapacityForLevel(progress.level),
    level: progress.level,
    xp: clan.xp,
    xpFloor: progress.floor,
    xpCeil: progress.ceil,
    xpCurrent: progress.current,
    xpNeeded: progress.needed,
    treasury: clan.treasury,
    shards: clan.shards,
    dailyReward: clanDailyXpReward(progress.level),
    inviteCode: clan.inviteCode || null,
    activeBanner: clan.activeBanner ? getGachaItem(clan.activeBanner) : null,
    bannerPosition: clan.bannerPosition || '50% 50%',
    unlockedItems: (clan.unlockedItems || []).map(getGachaItem).filter(Boolean),
    milestone: clanMilestone(progress.level),
    war: clan.war || null,
    warWins: clan.warWins || 0,
    warHistory: clan.warHistory || [],
    frame: clan.frame || 'ring',
    motd: clan.motd || null,
    buffs: clan.buffs || {},
    activeBuffs: getClanActiveBuffs(clan),
    weeklyQuest: {
      progress: clan.weeklyQuestWeek === isoWeekStr() ? (clan.weeklyQuestProgress || 0) : 0,
      target: weeklyQuestTarget(progress.level),
      reward: weeklyQuestReward(progress.level),
      claimed: clan.weeklyQuestWeek === isoWeekStr() ? !!clan.weeklyQuestClaimed : false
    },
    createdAt: clan.createdAt
  };
  if (withRank) {
    const rank = await redis.zrevrank(CLAN_RANK_ZSET, clan.id);
    out.rank = rank == null ? null : rank + 1;
  }
  if (withMembers) {
    const raw = await redis.hgetall(membersKey(clan.id));
    const entries = Object.entries(raw || {});
    const members = await Promise.all(entries.map(async ([uid, val]) => {
      const m = safeParse(val) || {};
      const u = await getUser(redis, uid);
      const totalContribution = (m.xpContributed || 0) + (m.xpDonated || 0);
      return {
        ...publicProfile(uid, u),
        role: m.role || 'MEMBER',
        roleLabel: ROLE_LABEL[m.role] || 'Member',
        joinedAt: m.joinedAt,
        title: memberTitle(uid, m.joinedAt, clan, m.customTitle),
        xpContributed: m.xpContributed || 0,
        xpDonated: m.xpDonated || 0,
        totalContribution,
        grade: memberGrade(totalContribution)
      };
    }));
    members.sort((a, b) => RANK[b.role] - RANK[a.role] || b.totalContribution - a.totalContribution);
    out.members = members;
  }
  return out;
}

// ===== CREATE =====
export async function createClan(redis, userId, { name, tag, desc, icon, color, joinType, minLevel, frame }) {
  name = (name || '').trim();
  tag = (tag || '').trim().toUpperCase();
  if (!name || name.length < 3 || name.length > 24) return { success: false, error: 'Nama clan harus 3-24 karakter' };
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) return { success: false, error: 'Tag harus 2-5 huruf/angka' };
  if (!['public', 'approval', 'invite'].includes(joinType)) return { success: false, error: 'Cara masuk tidak valid' };
  const isCustomIconUrl = typeof icon === 'string' && /^https?:\/\//.test(icon);
  if (!isCustomIconUrl && !CLAN_ICONS.includes(icon)) icon = CLAN_ICONS[0];
  if (!CLAN_COLORS.includes(color)) color = CLAN_COLORS[0];
  if (!CLAN_FRAMES.includes(frame)) frame = CLAN_FRAMES[0];

  const existingClanId = await getUserClanId(redis, userId);
  if (existingClanId) return { success: false, error: 'Kamu sudah tergabung di clan lain' };

  const nameLower = name.toLowerCase();
  if (await redis.hget(NAMES_HASH, nameLower)) return { success: false, error: 'Nama clan sudah dipakai' };
  if (await redis.hget(TAGS_HASH, tag)) return { success: false, error: 'Tag clan sudah dipakai' };

  const user = await getUser(redis, userId);
  const id = genId();
  const clan = defaultClan({
    id, name, tag, desc: (desc || '').slice(0, 140), icon, color,
    joinType, minLevel: Math.max(0, parseInt(minLevel, 10) || 0),
    leaderId: userId
  });
  clan.frame = frame;

  await Promise.all([
    saveClan(redis, clan),
    redis.hset(NAMES_HASH, { [nameLower]: id }),
    redis.hset(TAGS_HASH, { [tag]: id }),
    redis.hset(INVITE_CODES_HASH, { [clan.inviteCode]: id }),
    redis.set(userClanKey(userId), id),
    setMemberData(redis, id, userId, {
      role: 'LEADER', joinedAt: new Date().toISOString(),
      xpContributed: 0, xpDonated: 0, lastSyncedWatchTime: user?.watchTime || 0
    })
  ]);

  return { success: true, clan: await shapeClan(redis, clan) };
}

// ===== BROWSE / DETAIL =====
export async function listClans(redis, { q = '', sort = 'level', page = 0, limit = 20 } = {}) {
  const ids = await redis.zrange(CLAN_RANK_ZSET, 0, -1, { rev: sort !== 'newest' });
  let clans = (await Promise.all(ids.map((id) => loadClan(redis, id)))).filter(Boolean);

  if (sort === 'newest') clans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else clans.sort((a, b) => b.xp - a.xp);

  const query = q.trim().toLowerCase();
  if (query) {
    clans = clans.filter((c) => c.name.toLowerCase().includes(query) || c.tag.toLowerCase().includes(query));
  }

  const start = page * limit;
  const pageClans = clans.slice(start, start + limit);
  const shaped = await Promise.all(pageClans.map((c) => shapeClan(redis, c, { withRank: true })));
  return { success: true, clans: shaped, total: clans.length, hasMore: start + limit < clans.length };
}

export async function getClanDetail(redis, clanId, { fresh = false } = {}) {
  let clan = fresh ? await syncAllMembers(redis, clanId) : await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  clan = await finalizeWarIfNeeded(redis, clan);
  return { success: true, clan: await shapeClan(redis, clan, { withMembers: true, withRank: true }) };
}

export async function getMyClan(redis, userId) {
  const clanId = await getUserClanId(redis, userId);
  if (!clanId) return { success: true, clan: null };
  let clan = await syncAllMembers(redis, clanId);
  if (!clan) { await redis.del(userClanKey(userId)); return { success: true, clan: null }; }
  clan = await finalizeWarIfNeeded(redis, clan);

  const member = await getMemberData(redis, clanId, userId);

  const [shaped, dailyStatus, requests, invites] = await Promise.all([
    shapeClan(redis, clan, { withMembers: true, withRank: true }),
    (async () => {
      const joinedMs = new Date(member?.joinedAt || 0).getTime();
      const msSinceJoin = Date.now() - joinedMs;
      const newMemberWaitMs = 24 * 60 * 60 * 1000;
      if (msSinceJoin < newMemberWaitMs) {
        return { canClaim: false, secondsLeft: Math.ceil((newMemberWaitMs - msSinceJoin) / 1000), reason: 'new_member' };
      }
      const ttl = await redis.ttl(dailyClaimKey(clanId, userId));
      if (ttl && ttl > 0) return { canClaim: false, secondsLeft: ttl, reason: 'claimed' };
      return { canClaim: true, secondsLeft: 0, reason: null };
    })(),
    (async () => {
      const raw = await redis.hgetall(requestsKey(clanId));
      const entries = Object.entries(raw || {});
      return Promise.all(entries.map(async ([uid, val]) => {
        const info = safeParse(val) || {};
        const u = await getUser(redis, uid);
        return { ...publicProfile(uid, u), requestedAt: info.requestedAt };
      }));
    })(),
    (async () => {
      const raw = await redis.hgetall(invitesKey(clanId));
      const entries = Object.entries(raw || {});
      return Promise.all(entries.map(async ([uid, val]) => {
        const info = safeParse(val) || {};
        const u = await getUser(redis, uid);
        return { ...publicProfile(uid, u), invitedAt: info.invitedAt };
      }));
    })()
  ]);

  shaped.myRole = member?.role || 'MEMBER';
  shaped.myTitle = member ? memberTitle(userId, member.joinedAt, clan, member.customTitle) : null;
  const myTotalContribution = (member?.xpContributed || 0) + (member?.xpDonated || 0);
  shaped.myGrade = memberGrade(myTotalContribution);
  shaped.myXpContributed = member?.xpContributed || 0;
  shaped.myXpDonated = member?.xpDonated || 0;
  shaped.canClaimDaily = dailyStatus.canClaim;
  shaped.dailySecondsLeft = dailyStatus.secondsLeft;
  shaped.dailyWaitReason = dailyStatus.reason;
  shaped.requests = canModerateRequests(shaped.myRole) ? requests : [];
  shaped.pendingRequestCount = requests.length;
  shaped.invitesSent = canModerateRequests(shaped.myRole) ? invites : [];

  return { success: true, clan: shaped };
}

// ===== JOIN FLOWS =====
export async function joinClan(redis, userId, clanId) {
  const [existing, clan, user] = await Promise.all([getUserClanId(redis, userId), loadClan(redis, clanId), getUser(redis, userId)]);
  if (existing) return { success: false, error: 'Kamu sudah tergabung di clan lain' };
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (clan.joinType !== 'public') return { success: false, error: 'Clan ini tidak menerima join langsung' };
  const level = clanLevelFromXp(clan.xp);
  if (clan.memberCount >= clanCapacityForLevel(level)) return { success: false, error: 'Slot clan penuh' };
  if ((user?.level || 0) < clan.minLevel) return { success: false, error: `Butuh level akun minimal ${clan.minLevel}` };

  clan.memberCount += 1;
  await Promise.all([
    saveClan(redis, clan),
    redis.set(userClanKey(userId), clanId),
    setMemberData(redis, clanId, userId, {
      role: 'MEMBER', joinedAt: new Date().toISOString(),
      xpContributed: 0, xpDonated: 0, lastSyncedWatchTime: user?.watchTime || 0
    }),
    logClanActivity(redis, clanId, { type: 'join', userId, userName: user?.name || 'User' })
  ]);
  return { success: true, clanId };
}

export async function requestJoin(redis, userId, clanId) {
  const [existing, clan] = await Promise.all([getUserClanId(redis, userId), loadClan(redis, clanId)]);
  if (existing) return { success: false, error: 'Kamu sudah tergabung di clan lain' };
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (clan.joinType !== 'approval') return { success: false, error: 'Clan ini bukan tipe approval' };
  const already = await redis.hget(requestsKey(clanId), userId);
  if (already) return { success: false, error: 'Request sudah terkirim, tunggu ya' };
  await redis.hset(requestsKey(clanId), { [userId]: JSON.stringify({ requestedAt: new Date().toISOString() }) });
  return { success: true };
}

export async function cancelRequest(redis, userId, clanId) {
  await redis.hdel(requestsKey(clanId), userId);
  return { success: true };
}

export async function respondRequest(redis, actorId, clanId, targetUserId, accept) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canModerateRequests(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin' };
  const reqData = await redis.hget(requestsKey(clanId), targetUserId);
  if (!reqData) return { success: false, error: 'Request tidak ditemukan' };
  await redis.hdel(requestsKey(clanId), targetUserId);

  if (!accept) return { success: true, accepted: false };

  const existing = await getUserClanId(redis, targetUserId);
  if (existing) return { success: false, error: 'User sudah tergabung di clan lain' };
  const level = clanLevelFromXp(clan.xp);
  if (clan.memberCount >= clanCapacityForLevel(level)) return { success: false, error: 'Slot clan penuh' };

  const user = await getUser(redis, targetUserId);
  clan.memberCount += 1;
  await Promise.all([
    saveClan(redis, clan),
    redis.set(userClanKey(targetUserId), clanId),
    setMemberData(redis, clanId, targetUserId, {
      role: 'MEMBER', joinedAt: new Date().toISOString(),
      xpContributed: 0, xpDonated: 0, lastSyncedWatchTime: user?.watchTime || 0
    })
  ]);
  return { success: true, accepted: true };
}

// Undangan manual dari admin/officer ke user tertentu -- sengaja BYPASS minLevel &
// joinType (public/approval/invite), karena ini keputusan admin yang udah nunjuk orangnya
// langsung, beda kasus sama self-service join yang butuh syarat level.
export async function inviteUser(redis, actorId, clanId, targetUserId) {
  const [clan, actorMember, targetClanId] = await Promise.all([
    loadClan(redis, clanId), getMemberData(redis, clanId, actorId), getUserClanId(redis, targetUserId)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canModerateRequests(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin' };
  if (targetClanId) return { success: false, error: 'User itu sudah punya clan' };

  await Promise.all([
    redis.hset(invitesKey(clanId), { [targetUserId]: JSON.stringify({ invitedAt: new Date().toISOString(), invitedBy: actorId }) }),
    redis.sadd(userInvitesKey(targetUserId), clanId)
  ]);
  return { success: true };
}

export async function getMyInvites(redis, userId) {
  const clanIds = (await redis.smembers(userInvitesKey(userId))) || [];
  const invites = [];
  for (const clanId of clanIds) {
    const data = await redis.hget(invitesKey(clanId), userId);
    if (!data) { await redis.srem(userInvitesKey(userId), clanId); continue; }
    const clan = await loadClan(redis, clanId);
    if (!clan) { await redis.srem(userInvitesKey(userId), clanId); continue; }
    const info = safeParse(data) || {};
    invites.push({ clanId, name: clan.name, tag: clan.tag, icon: clan.icon, color: clan.color, invitedAt: info.invitedAt });
  }
  return { success: true, invites };
}

// Terima undangan admin -- tanpa cek minLevel (lihat catatan di inviteUser), cuma slot clan yg tetep dicek.
export async function respondInvite(redis, userId, clanId, accept) {
  const has = await redis.hget(invitesKey(clanId), userId);
  if (!has) return { success: false, error: 'Undangan tidak ditemukan' };
  await Promise.all([redis.hdel(invitesKey(clanId), userId), redis.srem(userInvitesKey(userId), clanId)]);
  if (!accept) return { success: true, accepted: false };

  const existing = await getUserClanId(redis, userId);
  if (existing) return { success: false, error: 'Kamu sudah tergabung di clan lain' };
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  const level = clanLevelFromXp(clan.xp);
  if (clan.memberCount >= clanCapacityForLevel(level)) return { success: false, error: 'Slot clan penuh' };

  const user = await getUser(redis, userId);
  clan.memberCount += 1;
  await Promise.all([
    saveClan(redis, clan),
    redis.set(userClanKey(userId), clanId),
    setMemberData(redis, clanId, userId, {
      role: 'MEMBER', joinedAt: new Date().toISOString(),
      xpContributed: 0, xpDonated: 0, lastSyncedWatchTime: user?.watchTime || 0
    })
  ]);
  return { success: true, accepted: true };
}

// ===== LEAVE / KICK / ROLE / DISBAND =====
async function removeMember(redis, clan, userId) {
  await Promise.all([
    redis.hdel(membersKey(clan.id), userId),
    redis.del(userClanKey(userId))
  ]);
  clan.memberCount = Math.max(0, clan.memberCount - 1);
  await saveClan(redis, clan);
}

export async function leaveClan(redis, userId, clanId) {
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (clan.leaderId === userId) return { success: false, error: 'Leader harus transfer kepemimpinan dulu sebelum keluar' };
  await removeMember(redis, clan, userId);
  return { success: true };
}

export async function kickMember(redis, actorId, clanId, targetUserId) {
  const [clan, actorMember, targetMember] = await Promise.all([
    loadClan(redis, clanId), getMemberData(redis, clanId, actorId), getMemberData(redis, clanId, targetUserId)
  ]);
  if (!clan || !targetMember) return { success: false, error: 'Data tidak ditemukan' };
  if (targetUserId === actorId) return { success: false, error: 'Tidak bisa kick diri sendiri' };
  if (!canKick(actorMember?.role, targetMember.role)) return { success: false, error: 'Kamu tidak punya izin kick role ini' };
  await removeMember(redis, clan, targetUserId);
  return { success: true };
}

export async function changeRole(redis, actorId, clanId, targetUserId, newRole) {
  if (!ROLES.includes(newRole) || newRole === 'LEADER') return { success: false, error: 'Role tidak valid' };
  const [actorMember, targetMember] = await Promise.all([
    getMemberData(redis, clanId, actorId), getMemberData(redis, clanId, targetUserId)
  ]);
  if (!targetMember) return { success: false, error: 'Member tidak ditemukan' };
  if (!canChangeRole(actorMember?.role, targetMember.role, newRole)) return { success: false, error: 'Kamu tidak punya izin ubah role ini' };
  targetMember.role = newRole;
  await setMemberData(redis, clanId, targetUserId, targetMember);
  return { success: true };
}

// Leader/Vice kasih gelar custom ke member (nongol di samping nama di
// member list & header profil). Kirim string kosong buat hapus gelar.
export async function setMemberTitle(redis, actorId, clanId, targetUserId, title) {
  const [actorMember, targetMember] = await Promise.all([
    getMemberData(redis, clanId, actorId), getMemberData(redis, clanId, targetUserId)
  ]);
  if (!targetMember) return { success: false, error: 'Member tidak ditemukan' };
  if (!canManage(actorMember?.role, targetMember.role, RANK.VICE)) return { success: false, error: 'Kamu tidak punya izin kasih gelar ke member ini' };
  const clean = (title || '').trim().slice(0, TITLE_MAX_LEN);
  targetMember.customTitle = clean || null;
  await setMemberData(redis, clanId, targetUserId, targetMember);
  return { success: true };
}

export async function transferLeadership(redis, actorId, clanId, targetUserId) {
  const [clan, targetMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, targetUserId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (clan.leaderId !== actorId) return { success: false, error: 'Hanya Leader yang bisa transfer' };
  if (!targetMember || targetUserId === actorId) return { success: false, error: 'Target tidak valid' };

  const actorMember = await getMemberData(redis, clanId, actorId);
  actorMember.role = 'VICE';
  targetMember.role = 'LEADER';
  clan.leaderId = targetUserId;
  await Promise.all([
    setMemberData(redis, clanId, actorId, actorMember),
    setMemberData(redis, clanId, targetUserId, targetMember),
    saveClan(redis, clan)
  ]);
  return { success: true };
}

export async function disbandClan(redis, actorId, clanId) {
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (clan.leaderId !== actorId) return { success: false, error: 'Hanya Leader yang bisa membubarkan clan' };

  const raw = await redis.hgetall(membersKey(clanId));
  const memberIds = Object.keys(raw || {});
  await Promise.all([
    redis.del(membersKey(clanId)),
    redis.del(requestsKey(clanId)),
    redis.del(invitesKey(clanId)),
    redis.del(chatKey(clanId)),
    redis.del(clanKey(clanId)),
    redis.zrem(CLAN_RANK_ZSET, clanId),
    redis.hdel(NAMES_HASH, clan.name.toLowerCase()),
    redis.hdel(TAGS_HASH, clan.tag),
    ...memberIds.map((uid) => redis.del(userClanKey(uid)))
  ]);
  return { success: true };
}

// ===== EDIT SETTINGS =====
export async function editClan(redis, actorId, clanId, patch) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin edit clan' };

  if (typeof patch.desc === 'string') clan.desc = patch.desc.slice(0, 140);
  if (typeof patch.icon === 'string' && /^https?:\/\//.test(patch.icon)) clan.icon = patch.icon;
  else if (CLAN_ICONS.includes(patch.icon)) clan.icon = patch.icon;
  if (CLAN_COLORS.includes(patch.color)) clan.color = patch.color;
  if (CLAN_FRAMES.includes(patch.frame)) clan.frame = patch.frame;
  if (typeof patch.bannerPosition === 'string') clan.bannerPosition = patch.bannerPosition;
  if (['public', 'approval', 'invite'].includes(patch.joinType)) clan.joinType = patch.joinType;
  if (Number.isFinite(patch.minLevel)) clan.minLevel = Math.max(0, Math.floor(patch.minLevel));
  if (typeof patch.motd === 'string') {
    const text = patch.motd.trim().slice(0, MOTD_MAX_LEN);
    clan.motd = text ? { text, setById: actorId, updatedAt: new Date().toISOString() } : null;
  }

  await saveClan(redis, clan);
  return { success: true, clan: await shapeClan(redis, clan) };
}

// ===== INVITE LINK/CODE =====
// Kode pendek (6 karakter) yang bisa di-share ke temen buat langsung gabung
// tanpa approval/invite manual -- kayak invite link Discord. Leader/Vice
// bisa generate ulang kalau kodenya kebocor/gak mau dipake lagi.
export async function regenerateInviteCode(redis, actorId, clanId) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin' };

  const oldCode = clan.inviteCode;
  const newCode = generateInviteCode();
  clan.inviteCode = newCode;

  await Promise.all([
    saveClan(redis, clan),
    oldCode ? redis.hdel(INVITE_CODES_HASH, oldCode) : Promise.resolve(),
    redis.hset(INVITE_CODES_HASH, { [newCode]: clanId })
  ]);
  return { success: true, inviteCode: newCode };
}

export async function joinByInviteCode(redis, userId, code) {
  code = (code || '').trim().toUpperCase();
  if (!code) return { success: false, error: 'Kode invite tidak valid' };

  const clanId = await redis.hget(INVITE_CODES_HASH, code);
  if (!clanId) return { success: false, error: 'Kode invite gak ditemukan atau udah gak berlaku' };

  const [existing, clan, user] = await Promise.all([getUserClanId(redis, userId), loadClan(redis, clanId), getUser(redis, userId)]);
  if (existing) return { success: false, error: 'Kamu sudah tergabung di clan lain' };
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  const level = clanLevelFromXp(clan.xp);
  if (clan.memberCount >= clanCapacityForLevel(level)) return { success: false, error: 'Slot clan penuh' };
  if ((user?.level || 0) < clan.minLevel) return { success: false, error: `Butuh level akun minimal ${clan.minLevel}` };

  clan.memberCount += 1;
  await Promise.all([
    saveClan(redis, clan),
    redis.set(userClanKey(userId), clanId),
    setMemberData(redis, clanId, userId, {
      role: 'MEMBER', joinedAt: new Date().toISOString(),
      xpContributed: 0, xpDonated: 0, lastSyncedWatchTime: user?.watchTime || 0
    }),
    logClanActivity(redis, clanId, { type: 'join', userId, userName: user?.name || 'User' })
  ]);
  return { success: true, clanId, clanName: clan.name };
}


// User "mengorbankan" sebagian XP akunnya sendiri (watchTime) buat langsung
// nambah level clan + harta bersama. Beda dari sinkron level-up otomatis
// (syncMemberContribution) yang pasif & kecil, donasi ini instan & 1:1 --
// pantas karena levelnya sendiri ikut turun.
export async function donateExp(redis, userId, clanId, amount) {
  amount = Math.floor(Number(amount));
  if (!amount || amount <= 0) return { success: false, error: 'Jumlah tidak valid' };
  const [user, member, clan] = await Promise.all([getUser(redis, userId), getMemberData(redis, clanId, userId), loadClan(redis, clanId)]);
  if (!member || !clan) return { success: false, error: 'Kamu bukan member clan ini' };
  const balance = user?.watchTime || 0;
  if (balance < amount) return { success: false, error: 'EXP kamu tidak cukup' };

  user.watchTime = balance - amount;
  user.level = Math.floor(user.watchTime / 600);
  clan.treasury += amount;
  addClanXp(clan, amount);
  member.xpDonated = (member.xpDonated || 0) + amount;

  await Promise.all([
    redis.set(`user:${userId}`, JSON.stringify(user)),
    redis.zadd('leaderboard', { score: user.watchTime, member: userId }),
    saveClan(redis, clan),
    setMemberData(redis, clanId, userId, member),
    logClanActivity(redis, clanId, { type: 'donate', userId, userName: user.name || 'User', amount })
  ]);
  return { success: true, watchTime: user.watchTime, level: user.level, treasury: clan.treasury };
}

// ===== KLAIM HARIAN =====
export async function claimDaily(redis, userId, clanId) {
  const [clan, member] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, userId)]);
  if (!clan || !member) return { success: false, error: 'Kamu bukan member clan ini' };

  const joinedMs = new Date(member.joinedAt).getTime();
  if (Date.now() - joinedMs < 24 * 60 * 60 * 1000) {
    return { success: false, error: 'Member baru perlu menunggu 24 jam sebelum klaim pertama' };
  }
  const already = await redis.get(dailyClaimKey(clanId, userId));
  if (already) return { success: false, error: 'Sudah diklaim hari ini, cek lagi besok' };

  const level = clanLevelFromXp(clan.xp);
  const reward = clanDailyXpReward(level);
  const user = await getUser(redis, userId);
  if (user) {
    user.watchTime = (user.watchTime || 0) + reward;
    user.level = Math.floor(user.watchTime / 600);
    await Promise.all([
      redis.set(`user:${userId}`, JSON.stringify(user)),
      redis.zadd('leaderboard', { score: user.watchTime, member: userId })
    ]);
  }
  await redis.set(dailyClaimKey(clanId, userId), '1', { ex: secondsUntilEndOfDayWIB() });
  return { success: true, reward, watchTime: user?.watchTime || 0 };
}

// ===== GIVE EXP (sekarang berupa "drop" yang ditempel ke komentar anime/chapter) =====
// User nyisipin sejumlah EXP miliknya ke komentar yang dia tulis di episode
// anime atau chapter manga. Slotnya dibatasi jumlah orang (maxClaims), BUKAN
// dibatasi waktu -- drop-nya tetap kebuka di komentar itu sampai semua slot
// habis diklaim, gak ada expiry. Biaya (amount x maxClaims) langsung dipotong
// dari EXP akun sendiri saat dibuat, dan langsung masuk ke level+harta clan --
// jadi gak perlu cooldown harian, karena udah otomatis dibatasi oleh EXP yang
// dipunya si pemberi.
const GIVE_EXP_MIN_AMOUNT = 5;
const GIVE_EXP_MIN_CLAIMS = 1;

export async function chargeGiveExpDrop(redis, userId, amount, maxClaims) {
  amount = Math.floor(Number(amount));
  maxClaims = Math.floor(Number(maxClaims));
  if (!amount || amount < GIVE_EXP_MIN_AMOUNT) {
    return { success: false, error: `EXP per klaim minimal ${GIVE_EXP_MIN_AMOUNT}` };
  }
  if (!maxClaims || maxClaims < GIVE_EXP_MIN_CLAIMS) {
    return { success: false, error: `Jumlah slot klaim minimal ${GIVE_EXP_MIN_CLAIMS}` };
  }

  const clanId = await getUserClanId(redis, userId);
  if (!clanId) return { success: false, error: 'Kamu harus tergabung di clan buat give EXP' };

  const totalCost = amount * maxClaims;
  const user = await getUser(redis, userId);
  const balance = user?.watchTime || 0;
  if (balance < totalCost) return { success: false, error: `EXP kamu gak cukup (butuh ${totalCost})` };

  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };

  user.watchTime = balance - totalCost;
  user.level = Math.floor(user.watchTime / 600);
  clan.treasury += totalCost;
  addClanXp(clan, totalCost);

  await Promise.all([
    redis.set(`user:${userId}`, JSON.stringify(user)),
    redis.zadd('leaderboard', { score: user.watchTime, member: userId }),
    saveClan(redis, clan),
    logClanActivity(redis, clanId, { type: 'giveexp', userId, userName: user.name || 'User', amount, maxClaims })
  ]);

  return { success: true, clanId, totalCost, amount, maxClaims };
}

// Give EXP LANGSUNG ke satu user tertentu (dari halaman profil orang itu) --
// beda dari drop di komentar, ini gak dibatasi harus di luar clan. Bisa ke
// siapa aja, termasuk member clan sendiri. Biaya dipotong dari EXP pemberi,
// clan pemberi tetap kebagian treasury+xp (pake charge yang sama kayak drop
// dengan maxClaims=1), dan penerima langsung dapet EXP-nya tanpa perlu klaim.
export async function giveExpDirect(redis, giverId, targetUserId, amount) {
  if (!targetUserId || targetUserId === giverId) {
    return { success: false, error: 'Target tidak valid' };
  }

  const charge = await chargeGiveExpDrop(redis, giverId, amount, 1);
  if (!charge.success) return charge;

  const target = await getUser(redis, targetUserId);
  if (!target) return { success: false, error: 'User tidak ditemukan' };

  target.watchTime = (target.watchTime || 0) + charge.amount;
  target.level = Math.floor(target.watchTime / 600);

  await Promise.all([
    redis.set(`user:${targetUserId}`, JSON.stringify(target)),
    redis.zadd('leaderboard', { score: target.watchTime, member: targetUserId })
  ]);

  return { success: true, amount: charge.amount, target: publicProfile(targetUserId, target) };
}

// Klaim EXP dari drop yang nempel di sebuah komentar. `comment` adalah objek
// komentar yang SUDAH di-parse (caller yang urus baca/tulis balik ke Redis
// list-nya, fungsi ini cuma validasi + mutasi objeknya).
export async function claimExpDropFromComment(redis, claimerId, comment) {
  const drop = comment?.expDrop;
  if (!drop) return { success: false, error: 'Komentar ini gak ada EXP buat diklaim' };
  if (drop.claimedCount >= drop.maxClaims) return { success: false, error: 'Slot EXP udah habis diklaim' };
  if (claimerId === drop.giverId) return { success: false, error: 'Gak bisa klaim EXP dari komentar sendiri' };
  if ((drop.claimedBy || []).includes(claimerId)) return { success: false, error: 'Kamu udah klaim EXP ini' };

  const claimerClanId = await getUserClanId(redis, claimerId);
  if (claimerClanId && claimerClanId === drop.clanId) {
    return { success: false, error: 'EXP ini cuma buat user di luar clan pemberi' };
  }

  const claimer = await getUser(redis, claimerId);
  if (!claimer) return { success: false, error: 'User tidak ditemukan' };

  claimer.watchTime = (claimer.watchTime || 0) + drop.amount;
  claimer.level = Math.floor(claimer.watchTime / 600);

  drop.claimedCount += 1;
  drop.claimedBy = [...(drop.claimedBy || []), claimerId];

  await Promise.all([
    redis.set(`user:${claimerId}`, JSON.stringify(claimer)),
    redis.zadd('leaderboard', { score: claimer.watchTime, member: claimerId })
  ]);

  return { success: true, amount: drop.amount, newWatchTime: claimer.watchTime, newLevel: claimer.level, drop };
}

// ===== GACHA =====
// Gacha bisa ditarik berkali-kali sekaligus (1-100x, custom). Biaya linear
// (count x GACHA_COST), tapi buat pull 10x ke atas ada "pity": minimal 1
// hasil dijamin rare-ke-atas, biar bulk pull selalu berasa worth it.
export async function pullGacha(redis, actorId, clanId, count = 1) {
  count = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));

  const [clan, actorMember, actorUser] = await Promise.all([
    loadClan(redis, clanId), getMemberData(redis, clanId, actorId), getUser(redis, actorId)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canGacha(actorMember?.role)) return { success: false, error: 'Hanya Leader/Vice yang bisa gacha' };

  const totalCost = GACHA_COST * count;
  if (clan.treasury < totalCost) return { success: false, error: `Harta clan kurang (butuh ${totalCost})` };

  clan.treasury -= totalCost;
  const owned = new Set(clan.unlockedItems || []);
  const results = [];
  const pityIndex = count >= 10 ? Math.floor(Math.random() * count) : -1;

  for (let i = 0; i < count; i++) {
    const item = i === pityIndex ? rollGachaItem({ minRarity: 'rare' }) : rollGachaItem();
    let resultType = 'new';
    let bonusItem = null;

    if (owned.has(item.id)) {
      clan.shards = (clan.shards || 0) + 1;
      resultType = 'duplicate';
      if (clan.shards >= 5) {
        const locked = GACHA_POOL.filter((it) => !owned.has(it.id) && it.id !== item.id);
        if (locked.length > 0) {
          bonusItem = locked[Math.floor(Math.random() * locked.length)];
          owned.add(bonusItem.id);
          clan.shards -= 5;
          resultType = 'duplicate_bonus';
        }
      }
    } else {
      owned.add(item.id);
    }
    results.push({ item, resultType, bonusItem });
  }

  clan.unlockedItems = [...owned];
  const bestRarity = results.reduce((best, r) => (
    RARITY_ORDER[r.item.rarity] > RARITY_ORDER[best] ? r.item.rarity : best
  ), 'normal');
  const bestItem = results.find((r) => r.item.rarity === bestRarity)?.item;

  await Promise.all([
    saveClan(redis, clan),
    logClanActivity(redis, clanId, {
      type: 'gacha', userId: actorId, userName: actorUser?.name || 'User',
      count, bestRarity, bestItemName: bestItem?.name
    })
  ]);

  return {
    success: true,
    results,
    count,
    totalCost,
    treasury: clan.treasury,
    shards: clan.shards,
    bestRarity
  };
}

export async function activateCosmetic(redis, actorId, clanId, type, itemId) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin' };
  if (!(clan.unlockedItems || []).includes(itemId)) return { success: false, error: 'Item belum dimiliki clan' };
  const item = getGachaItem(itemId);
  if (!item || item.type !== type || type !== 'banner') return { success: false, error: 'Item tidak valid' };

  clan.activeBanner = itemId;
  await saveClan(redis, clan);
  return { success: true };
}

// ===== CLAN WAR =====
// Duel antar clan: Leader/Vice bisa nantang clan lain lewat tag. Kalau
// diterima, kedua clan masuk periode war selama WAR_DURATION_MS -- skor war
// numpang di clan XP yang sama (lihat addClanXp), jadi SEMUA sumber XP
// (nonton/baca, donate, give exp) otomatis nyumbang ke skor war real-time,
// gak perlu sistem tracking terpisah. Yang XP-nya lebih banyak pas periode
// berakhir menang, dapet treasury bonus + item gacha tier tinggi gratis.
//
// War di-finalize secara LAZY (sama kayak weekly quest / lazy xp sync):
// dicek tiap kali clan dimuat (getMyClan/getClanDetail), bukan pake cron.
const WAR_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari
const WAR_REWARD_BASE = 800;
const WAR_REWARD_PER_LEVEL = 40;
const WAR_CONSOLATION = GACHA_COST; // kalah pun tetep dapet modal 1x gacha
const MAX_WAR_HISTORY = 5;

function warSummary(clan, opponent) {
  return {
    opponentId: opponent.id, opponentName: opponent.name, opponentTag: opponent.tag,
    opponentIcon: opponent.icon, opponentColor: opponent.color, opponentFrame: opponent.frame || 'ring'
  };
}

// Dipanggil tiap clan dimuat -- kalau war-nya udah lewat endsAt, tutup dan
// bagiin hadiah. Aman dipanggil dari kedua sisi clan secara independen
// karena masing-masing cuma NULIS ke dirinya sendiri, cuma BACA skor lawan.
async function finalizeWarIfNeeded(redis, clan) {
  if (!clan?.war || clan.war.status !== 'active') return clan;
  if (Date.now() < new Date(clan.war.endsAt).getTime()) return clan;

  const opponent = await loadClan(redis, clan.war.opponentId);
  const myScore = clan.war.score || 0;
  const oppScore = opponent?.war?.score ?? 0;

  let result;
  if (!opponent) result = 'win'; // menang WO kalau clan lawan udah bubar
  else if (myScore > oppScore) result = 'win';
  else if (myScore < oppScore) result = 'lose';
  else result = 'draw';

  const level = clanLevelFromXp(clan.xp);
  const reward = WAR_REWARD_BASE + level * WAR_REWARD_PER_LEVEL;
  let wonItemId = null;

  if (result === 'win') {
    clan.treasury += reward;
    clan.warWins = (clan.warWins || 0) + 1;
    const owned = new Set(clan.unlockedItems || []);
    const highPool = GACHA_POOL.filter((i) => !owned.has(i.id) && RARITY_ORDER[i.rarity] >= RARITY_ORDER.epic);
    const pool = highPool.length ? highPool : GACHA_POOL.filter((i) => !owned.has(i.id));
    if (pool.length) {
      const won = pool[Math.floor(Math.random() * pool.length)];
      owned.add(won.id);
      clan.unlockedItems = [...owned];
      wonItemId = won.id;
    }
  } else if (result === 'draw') {
    clan.treasury += Math.floor(reward / 2);
  } else {
    clan.treasury += WAR_CONSOLATION;
  }

  clan.warHistory = [
    {
      opponentName: clan.war.opponentName, opponentTag: clan.war.opponentTag,
      result, myScore, opponentScore: oppScore, wonItemId, endedAt: new Date().toISOString()
    },
    ...(clan.warHistory || [])
  ].slice(0, MAX_WAR_HISTORY);

  await logClanActivity(redis, clan.id, {
    type: 'war_end', result, opponentName: clan.war.opponentName, myScore, opponentScore: oppScore
  });

  clan.war = null;
  await saveClan(redis, clan);
  return clan;
}

// Leader/Vice nantang clan lain lewat tag mereka.
export async function warChallenge(redis, actorId, clanId, targetTag) {
  const [clan, actorMember, actorUser] = await Promise.all([
    loadClan(redis, clanId), getMemberData(redis, clanId, actorId), getUser(redis, actorId)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Cuma Leader/Vice yang bisa nantang war' };
  if (clan.war) return { success: false, error: 'Clan kamu masih ada urusan war (lagi jalan/nunggu respon)' };

  const tag = (targetTag || '').trim().toUpperCase();
  if (!tag) return { success: false, error: 'Tag clan tujuan wajib diisi' };
  const targetClanId = await redis.hget(TAGS_HASH, tag);
  if (!targetClanId) return { success: false, error: 'Clan dengan tag itu gak ketemu' };
  if (targetClanId === clanId) return { success: false, error: 'Gak bisa nantang clan sendiri' };

  const target = await loadClan(redis, targetClanId);
  if (!target) return { success: false, error: 'Clan tidak ditemukan' };
  if (target.war) return { success: false, error: `${target.name} lagi ada urusan war lain` };

  const requestedAt = new Date().toISOString();
  clan.war = { status: 'pending_outgoing', ...warSummary(clan, target), requestedAt };
  target.war = { status: 'pending_incoming', ...warSummary(target, clan), requestedAt };

  await Promise.all([
    saveClan(redis, clan), saveClan(redis, target),
    logClanActivity(redis, clanId, { type: 'war_challenge_sent', userId: actorId, userName: actorUser?.name || 'User', opponentName: target.name }),
    logClanActivity(redis, targetClanId, { type: 'war_challenge_received', opponentName: clan.name })
  ]);
  return { success: true };
}

// Leader/Vice clan yang ditantang, terima/tolak.
export async function warRespond(redis, actorId, clanId, accept) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Cuma Leader/Vice yang bisa respon war' };
  if (!clan.war || clan.war.status !== 'pending_incoming') return { success: false, error: 'Gak ada tantangan war yang masuk' };

  const opponent = await loadClan(redis, clan.war.opponentId);
  if (!opponent) {
    clan.war = null;
    await saveClan(redis, clan);
    return { success: false, error: 'Clan penantang udah gak ada' };
  }

  if (accept) {
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const endsAt = new Date(now + WAR_DURATION_MS).toISOString();
    clan.war = { status: 'active', ...warSummary(clan, opponent), score: 0, startedAt, endsAt };
    opponent.war = { status: 'active', ...warSummary(opponent, clan), score: 0, startedAt, endsAt };
  } else {
    clan.war = null;
    opponent.war = null;
  }

  await Promise.all([
    saveClan(redis, clan), saveClan(redis, opponent),
    logClanActivity(redis, clan.id, { type: accept ? 'war_start' : 'war_declined', opponentName: opponent.name }),
    logClanActivity(redis, opponent.id, { type: accept ? 'war_start' : 'war_declined', opponentName: clan.name })
  ]);
  return { success: true, accepted: accept };
}

// Batalin tantangan yang dikirim sendiri (selama masih pending_outgoing).
export async function warCancel(redis, actorId, clanId) {
  const [clan, actorMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, actorId)]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Kamu tidak punya izin' };
  if (!clan.war || clan.war.status !== 'pending_outgoing') return { success: false, error: 'Gak ada tantangan yang bisa dibatalin' };

  const opponent = await loadClan(redis, clan.war.opponentId);
  clan.war = null;
  const tasks = [saveClan(redis, clan)];
  if (opponent && opponent.war?.opponentId === clanId) {
    opponent.war = null;
    tasks.push(saveClan(redis, opponent));
  }
  await Promise.all(tasks);
  return { success: true };
}


// Feed kecil biar clan berasa "hidup" -- nyatet momen-momen yang bikin
// exciting (gacha, donasi, join member baru) tanpa perlu buka riwayat chat.
const MAX_ACTIVITY_LOG = 40;

async function logClanActivity(redis, clanId, entry) {
  const item = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), ...entry };
  await redis.lpush(activityLogKey(clanId), JSON.stringify(item));
  await redis.ltrim(activityLogKey(clanId), 0, MAX_ACTIVITY_LOG - 1);
}

export async function getClanActivity(redis, userId, clanId) {
  const clanIdOfUser = await getUserClanId(redis, userId);
  if (clanIdOfUser !== clanId) return { success: false, error: 'Kamu bukan member clan ini' };
  const raw = await redis.lrange(activityLogKey(clanId), 0, MAX_ACTIVITY_LOG - 1);
  return { success: true, activity: (raw || []).map(safeParse).filter(Boolean) };
}

// ===== CHAT CLAN =====
const MAX_CHAT_MESSAGES = 200;

export async function getClanChat(redis, userId, clanId) {
  const clanIdOfUser = await getUserClanId(redis, userId);
  if (clanIdOfUser !== clanId) return { success: false, error: 'Kamu bukan member clan ini' };
  const raw = await redis.lrange(chatKey(clanId), 0, 79);
  const messages = (raw || []).map(safeParse).filter(Boolean).reverse();
  return { success: true, messages };
}

export async function sendClanChat(redis, userId, clanId, text) {
  text = (text || '').trim().slice(0, 500);
  if (!text) return { success: false, error: 'Pesan kosong' };
  const clanIdOfUser = await getUserClanId(redis, userId);
  if (clanIdOfUser !== clanId) return { success: false, error: 'Kamu bukan member clan ini' };

  const [user, member] = await Promise.all([getUser(redis, userId), getMemberData(redis, clanId, userId)]);
  const message = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId,
    name: user?.name || 'User',
    picture: user?.picture || null,
    role: member?.role || 'MEMBER',
    text,
    createdAt: new Date().toISOString()
  };
  await redis.lpush(chatKey(clanId), JSON.stringify(message));
  await redis.ltrim(chatKey(clanId), 0, MAX_CHAT_MESSAGES - 1);
  return { success: true, message };
}

// ===== ADMIN OVERRIDE =====
// Fungsi-fungsi ini gak ngecek role member sama sekali -- caller (route
// handler) WAJIB udah mastiin yang manggil beneran admin situs sebelum
// pakai fungsi-fungsi di bawah ini. Dipakai panel admin buat kelola SEMUA
// clan tanpa harus jadi Leader/Vice di clan itu.

export async function adminListClans(redis) {
  const ids = await redis.zrange(CLAN_RANK_ZSET, 0, -1, { rev: true });
  const clans = (await Promise.all(ids.map((id) => loadClan(redis, id)))).filter(Boolean);
  const shaped = await Promise.all(clans.map((c) => shapeClan(redis, c, { withMembers: true, withRank: true })));
  return { success: true, clans: shaped };
}

export async function adminEditClan(redis, clanId, patch) {
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };

  if (typeof patch.name === 'string') {
    const newName = patch.name.trim();
    if (newName.length >= 3 && newName.length <= 24 && newName.toLowerCase() !== clan.name.toLowerCase()) {
      const existing = await redis.hget(NAMES_HASH, newName.toLowerCase());
      if (existing && existing !== clanId) return { success: false, error: 'Nama clan sudah dipakai' };
      await redis.hdel(NAMES_HASH, clan.name.toLowerCase());
      await redis.hset(NAMES_HASH, { [newName.toLowerCase()]: clanId });
      clan.name = newName;
    }
  }
  if (typeof patch.tag === 'string') {
    const newTag = patch.tag.trim().toUpperCase();
    if (/^[A-Z0-9]{2,5}$/.test(newTag) && newTag !== clan.tag) {
      const existingTag = await redis.hget(TAGS_HASH, newTag);
      if (existingTag && existingTag !== clanId) return { success: false, error: 'Tag clan sudah dipakai' };
      await redis.hdel(TAGS_HASH, clan.tag);
      await redis.hset(TAGS_HASH, { [newTag]: clanId });
      clan.tag = newTag;
    }
  }
  if (typeof patch.desc === 'string') clan.desc = patch.desc.slice(0, 140);
  if (typeof patch.icon === 'string' && (/^https?:\/\//.test(patch.icon) || CLAN_ICONS.includes(patch.icon))) clan.icon = patch.icon;
  if (CLAN_COLORS.includes(patch.color)) clan.color = patch.color;
  if (typeof patch.bannerPosition === 'string') clan.bannerPosition = patch.bannerPosition;
  if (['public', 'approval', 'invite'].includes(patch.joinType)) clan.joinType = patch.joinType;
  if (Number.isFinite(Number(patch.minLevel))) clan.minLevel = Math.max(0, Math.floor(Number(patch.minLevel)));
  if (Number.isFinite(Number(patch.xp))) clan.xp = Math.max(0, Math.floor(Number(patch.xp)));
  if (Number.isFinite(Number(patch.treasury))) clan.treasury = Math.max(0, Math.floor(Number(patch.treasury)));

  await saveClan(redis, clan);
  return { success: true, clan: await shapeClan(redis, clan, { withMembers: true, withRank: true }) };
}

export async function adminSetMemberRole(redis, clanId, targetUserId, newRole) {
  if (!ROLES.includes(newRole)) return { success: false, error: 'Role tidak valid' };
  const [clan, targetMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, targetUserId)]);
  if (!clan || !targetMember) return { success: false, error: 'Data tidak ditemukan' };

  if (newRole === 'LEADER' && clan.leaderId !== targetUserId) {
    if (clan.leaderId) {
      const oldLeader = await getMemberData(redis, clanId, clan.leaderId);
      if (oldLeader) { oldLeader.role = 'VICE'; await setMemberData(redis, clanId, clan.leaderId, oldLeader); }
    }
    clan.leaderId = targetUserId;
    await saveClan(redis, clan);
  }
  targetMember.role = newRole;
  await setMemberData(redis, clanId, targetUserId, targetMember);
  return { success: true };
}

export async function adminKickMember(redis, clanId, targetUserId) {
  const [clan, targetMember] = await Promise.all([loadClan(redis, clanId), getMemberData(redis, clanId, targetUserId)]);
  if (!clan || !targetMember) return { success: false, error: 'Data tidak ditemukan' };
  if (clan.leaderId === targetUserId) {
    return { success: false, error: 'Gak bisa kick Leader -- ganti Leader-nya dulu atau bubarkan clan-nya' };
  }
  await removeMember(redis, clan, targetUserId);
  return { success: true };
}

export async function adminDisbandClan(redis, clanId) {
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };

  const raw = await redis.hgetall(membersKey(clanId));
  const memberIds = Object.keys(raw || {});
  await Promise.all([
    redis.del(membersKey(clanId)),
    redis.del(requestsKey(clanId)),
    redis.del(invitesKey(clanId)),
    redis.del(chatKey(clanId)),
    redis.del(clanKey(clanId)),
    redis.zrem(CLAN_RANK_ZSET, clanId),
    redis.hdel(NAMES_HASH, clan.name.toLowerCase()),
    redis.hdel(TAGS_HASH, clan.tag),
    ...memberIds.map((uid) => redis.del(userClanKey(uid)))
  ]);
  return { success: true };
}

// Paksa buka item gacha buat clan tertentu (dan langsung diaktifin sebagai
// banner) -- berguna buat reward manual atau benerin gacha yang nyangkut.
export async function adminGrantGachaItem(redis, clanId, itemId) {
  const clan = await loadClan(redis, clanId);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  const item = getGachaItem(itemId);
  if (!item) return { success: false, error: 'Item gacha tidak ditemukan' };

  clan.unlockedItems = clan.unlockedItems || [];
  if (!clan.unlockedItems.includes(itemId)) clan.unlockedItems.push(itemId);
  clan.activeBanner = itemId;

  await saveClan(redis, clan);
  return { success: true, clan: await shapeClan(redis, clan) };
}

// ===== CLAN BUFFS & PERK SHOP =====
export const CLAN_BUFFS = [
  {
    id: 'xp_haste',
    name: 'Expedition Haste',
    desc: 'Bonus +25% XP dari nonton, baca komik, & quest untuk SEMUA member klan.',
    cost: 2500,
    durationHours: 24,
    icon: 'Zap',
    color: '#38bdf8'
  },
  {
    id: 'coin_prosperity',
    name: 'Prosperity Blessing',
    desc: 'Bonus +30% Koin Kuno dari misi harian & event untuk SEMUA member klan.',
    cost: 3000,
    durationHours: 24,
    icon: 'Coins',
    color: '#eab308'
  },
  {
    id: 'arena_vigor',
    name: 'Colosseum Vigor',
    desc: 'Bonus +15% Damage & Defense di Card Arena untuk SEMUA member klan.',
    cost: 2800,
    durationHours: 24,
    icon: 'Swords',
    color: '#ef4444'
  },
  {
    id: 'astral_fortune',
    name: 'Astral Fortune',
    desc: 'Peluang drop item langka & tiket gacha bertambah +20% untuk SEMUA member klan.',
    cost: 3500,
    durationHours: 24,
    icon: 'Sparkles',
    color: '#a855f7'
  }
];

export const getClanActiveBuffs = (clan) => {
  const buffs = clan?.buffs || {};
  const now = Date.now();
  const active = [];
  for (const b of CLAN_BUFFS) {
    const expiresAt = buffs[b.id];
    if (expiresAt && expiresAt > now) {
      active.push({
        ...b,
        expiresAt,
        remainingSeconds: Math.floor((expiresAt - now) / 1000)
      });
    }
  }
  return active;
};

export async function buyClanBuff(redis, actorId, clanId, buffId) {
  const [clan, actorMember] = await Promise.all([
    loadClan(redis, clanId),
    getMemberData(redis, clanId, actorId)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Hanya Leader atau Vice Leader yang bisa mengaktifkan Buff Klan' };

  const buff = CLAN_BUFFS.find((b) => b.id === buffId);
  if (!buff) return { success: false, error: 'Buff tidak ditemukan' };

  if ((clan.treasury || 0) < buff.cost) {
    return { success: false, error: `Kas Klan tidak cukup (Butuh ${buff.cost.toLocaleString()} Koin)` };
  }

  clan.treasury -= buff.cost;
  clan.buffs = clan.buffs || {};
  const currentExpiry = clan.buffs[buff.id] && clan.buffs[buff.id] > Date.now() ? clan.buffs[buff.id] : Date.now();
  clan.buffs[buff.id] = currentExpiry + buff.durationHours * 3600 * 1000;

  await saveClan(redis, clan);
  await logClanActivity(redis, clanId, {
    type: 'buff_activated',
    userId: actorId,
    buffName: buff.name
  });

  return {
    success: true,
    clan: await shapeClan(redis, clan),
    buff: { ...buff, expiresAt: clan.buffs[buff.id] }
  };
}

// ===== CLAN EXPEDITION DUNGEONS =====
export const EXPEDITION_DUNGEONS = [
  {
    id: 'dungeon_abyss_forest',
    name: 'Labirin Hutan Abyssal',
    desc: 'Eksplorasi rimba gelap berkabut racun untuk mengumpulkan kristal mana kuno.',
    requiredPower: 15000,
    icon: 'Flame',
    color: '#10b981',
    rewards: { treasury: 2000, clanXp: 3000, tickets: 1 }
  },
  {
    id: 'dungeon_raijin_temple',
    name: 'Kuil Petir Gunung Raijin',
    desc: 'Mendaki kuil dewa guntur di puncak gunung dan taklukkan penjaga badai.',
    requiredPower: 35000,
    icon: 'Zap',
    color: '#38bdf8',
    rewards: { treasury: 4500, clanXp: 6000, tickets: 2 }
  },
  {
    id: 'dungeon_void_citadel',
    name: 'Benteng Dimensi Void Kuno',
    desc: 'Serbuan akbar menembus distorsi realitas untuk meruntuhkan armada void.',
    requiredPower: 80000,
    icon: 'Crown',
    color: '#a855f7',
    rewards: { treasury: 10000, clanXp: 15000, tickets: 3 }
  }
];

const expeditionKey = (clanId, isoWeek) => `clan:expedition:${clanId}:${isoWeek}`;
const expeditionClaimedKey = (clanId, isoWeek, dungeonId) => `clan:expedition_claimed:${clanId}:${isoWeek}:${dungeonId}`;
const expeditionUserCdKey = (userId, todayStr) => `clan:expedition_cd:${userId}:${todayStr}`;

export async function getClanExpeditions(redis, userId, clanId) {
  const week = isoWeekStr();
  const today = nowWIB().toISOString().split('T')[0];
  const [clan, rawExp, hasDeployed] = await Promise.all([
    loadClan(redis, clanId),
    redis.hgetall(expeditionKey(clanId, week)),
    userId ? redis.get(expeditionUserCdKey(userId, today)) : Promise.resolve(null)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };

  const dungeons = await Promise.all(EXPEDITION_DUNGEONS.map(async (d) => {
    const power = parseInt(rawExp?.[d.id] || 0, 10) || 0;
    const claimed = !!(await redis.get(expeditionClaimedKey(clanId, week, d.id)));
    const completed = power >= d.requiredPower;
    return {
      ...d,
      currentPower: Math.min(d.requiredPower, power),
      completed,
      claimed,
      canClaim: completed && !claimed
    };
  }));

  return {
    success: true,
    dungeons,
    canDeploy: !hasDeployed,
    week
  };
}

export async function deployExpeditionSquad(redis, userId, clanId, dungeonId) {
  const today = nowWIB().toISOString().split('T')[0];
  const cdKey = expeditionUserCdKey(userId, today);
  const alreadyDeployed = await redis.get(cdKey);
  if (alreadyDeployed) return { success: false, error: 'Kamu sudah mengirim pasukan ekspedisi hari ini! Coba lagi besok.' };

  const [clan, user, rawDeck] = await Promise.all([
    loadClan(redis, clanId),
    getUser(redis, userId),
    redis.get(`user:deck:${userId}`)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };

  const dungeon = EXPEDITION_DUNGEONS.find((d) => d.id === dungeonId);
  if (!dungeon) return { success: false, error: 'Dungeon tidak ditemukan' };

  // Hitung total power squad member
  let squadPower = (user?.level || 1) * 150 + 1200;
  if (rawDeck) {
    try {
      const deck = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
      if (Array.isArray(deck) && deck.length > 0) {
        const cp = deck.reduce((acc, c) => acc + (c.attack || 500) + (c.defense || 400), 0);
        if (cp > 0) squadPower = Math.max(squadPower, cp);
      }
    } catch {}
  }

  const week = isoWeekStr();
  const expK = expeditionKey(clanId, week);
  const newTotal = await redis.hincrby(expK, dungeonId, squadPower);

  // Set cooldown sampai akhir hari WIB
  await redis.set(cdKey, '1', { ex: secondsUntilEndOfDayWIB() });

  await logClanActivity(redis, clanId, {
    type: 'expedition_deploy',
    userId,
    userName: user?.name || 'Member',
    power: squadPower,
    dungeonName: dungeon.name
  });

  return {
    success: true,
    powerContributed: squadPower,
    currentTotalPower: newTotal,
    targetPower: dungeon.requiredPower
  };
}

export async function claimExpeditionReward(redis, actorId, clanId, dungeonId) {
  const week = isoWeekStr();
  const [clan, actorMember, rawExp] = await Promise.all([
    loadClan(redis, clanId),
    getMemberData(redis, clanId, actorId),
    redis.hgetall(expeditionKey(clanId, week))
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Hanya Leader atau Vice Leader yang bisa mengklaim reward ekspedisi' };

  const dungeon = EXPEDITION_DUNGEONS.find((d) => d.id === dungeonId);
  if (!dungeon) return { success: false, error: 'Dungeon tidak ditemukan' };

  const power = parseInt(rawExp?.[dungeonId] || 0, 10) || 0;
  if (power < dungeon.requiredPower) return { success: false, error: 'Target power ekspedisi belum tercapai' };

  const claimKey = expeditionClaimedKey(clanId, week, dungeonId);
  const alreadyClaimed = await redis.get(claimKey);
  if (alreadyClaimed) return { success: false, error: 'Reward dungeon ini sudah diklaim minggu ini' };

  await redis.set(claimKey, '1', { ex: 604800 }); // 7 hari

  // Tambahkan Treasury & Clan XP
  clan.treasury = (clan.treasury || 0) + dungeon.rewards.treasury;
  await addClanXp(redis, clan, dungeon.rewards.clanXp);

  await logClanActivity(redis, clanId, {
    type: 'expedition_cleared',
    dungeonName: dungeon.name,
    treasuryReward: dungeon.rewards.treasury,
    xpReward: dungeon.rewards.clanXp
  });

  return {
    success: true,
    rewards: dungeon.rewards,
    clan: await shapeClan(redis, clan)
  };
}

export async function warAutoMatchmake(redis, actorId, clanId) {
  const [clan, actorMember] = await Promise.all([
    loadClan(redis, clanId),
    getMemberData(redis, clanId, actorId)
  ]);
  if (!clan) return { success: false, error: 'Clan tidak ditemukan' };
  if (!canEditClan(actorMember?.role)) return { success: false, error: 'Cuma Leader/Vice yang bisa memulai War Matchmaking' };
  if (clan.war) return { success: false, error: 'Clan kamu masih ada urusan war aktif/menunggu' };

  // Ambil list clan dari rank zset
  const allClanIds = await redis.zrevrange(CLAN_RANK_ZSET, 0, 30);
  const myLevel = clanLevelFromXp(clan.xp);

  let candidate = null;
  for (const cid of allClanIds) {
    if (cid === clanId) continue;
    const opp = await loadClan(redis, cid);
    if (!opp || opp.war) continue;
    const oppLevel = clanLevelFromXp(opp.xp);
    if (Math.abs(oppLevel - myLevel) <= 8) {
      candidate = opp;
      break;
    }
  }

  if (!candidate) {
    for (const cid of allClanIds) {
      if (cid === clanId) continue;
      const opp = await loadClan(redis, cid);
      if (opp && !opp.war) {
        candidate = opp;
        break;
      }
    }
  }

  if (!candidate) {
    return { success: false, error: 'Belum ada clan lawan yang tersedia untuk matchmaking saat ini. Coba tantang langsung via Tag!' };
  }

  return warChallenge(redis, actorId, clanId, candidate.tag);
}
