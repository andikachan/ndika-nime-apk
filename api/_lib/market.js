import { CARDS_DATABASE, getCardById } from '../../src/utils/cardsData.js';
import { gachaStatsKey, userCardsKey, addCardsToUser } from './cards.js';

// Keys untuk Redis Pasar Lelang & Barter
export const MARKET_LISTINGS_ZSET = 'market:active_listings';
export const listingKey = (id) => `market:listing:${id}`;
export const listingBidsKey = (id) => `market:bids:${id}`;
export const userListingsKey = (userId) => `market:user_listings:${userId}`;
export const userBidsKey = (userId) => `market:user_bids:${userId}`;

export const tradeKey = (id) => `trade:offer:${id}`;
export const userSentTradesKey = (userId) => `trade:sent:${userId}`;
export const userReceivedTradesKey = (userId) => `trade:received:${userId}`;

const MIN_BID_INCREMENT = 50;
const DEFAULT_DURATION_HOURS = 48; // 2 hari

// Helper Ambil Data User Ringkas
async function getUserBrief(redis, userId) {
  const raw = await redis.get(`user:${userId}`);
  if (!raw) return { id: userId, name: 'Petualang', picture: null };
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    id: userId,
    name: u.name || 'Petualang',
    picture: u.picture || null,
    level: u.level || 1
  };
}

// Helper Kurangi 1 Kartu dari Inventory User (Escrow)
async function deductCardFromUser(redis, userId, cardId) {
  const cardsK = userCardsKey(userId);
  const raw = await redis.get(cardsK);
  if (!raw) return false;
  const userCards = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!userCards[cardId] || userCards[cardId].count < 1) return false;

  const currentCount = userCards[cardId].count;
  if (currentCount <= 1) {
    delete userCards[cardId];
  } else {
    userCards[cardId].count = currentCount - 1;
    userCards[cardId].stars = Math.min(5, Math.floor(1 + (currentCount - 1) / 2));
  }

  await redis.set(cardsK, JSON.stringify(userCards));
  return true;
}

// Helper Tambah Koin ke User
async function addCoinsToUser(redis, userId, amount) {
  if (!amount || amount <= 0) return;
  const gKey = gachaStatsKey(userId);
  const rawG = await redis.get(gKey);
  if (rawG) {
    const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
    gStats.coins = (gStats.coins || 0) + amount;
    await redis.set(gKey, JSON.stringify(gStats));
  }

  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const uData = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    uData.coins = (uData.coins || 0) + amount;
    await redis.set(uKey, JSON.stringify(uData));
  }
}

// Helper Kurangi Koin dari User
async function deductCoinsFromUser(redis, userId, amount) {
  const gKey = gachaStatsKey(userId);
  const rawG = await redis.get(gKey);
  if (!rawG) return false;
  const gStats = typeof rawG === 'string' ? JSON.parse(rawG) : rawG;
  if ((gStats.coins || 0) < amount) return false;

  gStats.coins = (gStats.coins || 0) - amount;
  await redis.set(gKey, JSON.stringify(gStats));

  const uKey = `user:${userId}`;
  const rawU = await redis.get(uKey);
  if (rawU) {
    const uData = typeof rawU === 'string' ? JSON.parse(rawU) : rawU;
    uData.coins = Math.max(0, (uData.coins || 0) - amount);
    await redis.set(uKey, JSON.stringify(uData));
  }
  return true;
}

// ===== 1. BUAT LISTING PASAR LELANG BARU =====
export async function createMarketListing(redis, userId, { cardId, startingBid, buyoutPrice, durationHours = 48 }) {
  const startBid = Math.max(100, parseInt(startingBid, 10) || 100);
  const buyout = buyoutPrice ? Math.max(startBid + 50, parseInt(buyoutPrice, 10) || 0) : null;
  const hours = Math.min(72, Math.max(12, parseInt(durationHours, 10) || DEFAULT_DURATION_HOURS));

  const cardDef = getCardById(cardId);
  if (!cardDef) return { success: false, error: 'Kartu tidak valid' };

  // Ambil kartu dari inventory user (Escrow)
  const deducted = await deductCardFromUser(redis, userId, cardId);
  if (!deducted) return { success: false, error: 'Kamu tidak memiliki kartu ini di inventory' };

  const seller = await getUserBrief(redis, userId);
  const listingId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const expiresAt = now + hours * 3600 * 1000;

  const listing = {
    id: listingId,
    sellerId: userId,
    sellerName: seller.name,
    sellerAvatar: seller.picture,
    cardId: cardDef.id,
    card: cardDef,
    startingBid: startBid,
    currentBid: startBid,
    highestBidderId: null,
    highestBidderName: null,
    buyoutPrice: buyout,
    bidsCount: 0,
    status: 'active', // 'active' | 'sold' | 'cancelled' | 'expired'
    createdAt: now,
    expiresAt
  };

  await Promise.all([
    redis.set(listingKey(listingId), JSON.stringify(listing)),
    redis.zadd(MARKET_LISTINGS_ZSET, { score: expiresAt, member: listingId }),
    redis.sadd(userListingsKey(userId), listingId)
  ]);

  return { success: true, listing };
}

// ===== 2. PASANG TAWARAN (BID) =====
export async function placeMarketBid(redis, userId, { listingId, bidAmount }) {
  const rawList = await redis.get(listingKey(listingId));
  if (!rawList) return { success: false, error: 'Listing tidak ditemukan' };
  const listing = typeof rawList === 'string' ? JSON.parse(rawList) : rawList;

  if (listing.status !== 'active') return { success: false, error: 'Listing ini sudah tidak aktif' };
  if (Date.now() >= listing.expiresAt) {
    await processExpiredListing(redis, listing);
    return { success: false, error: 'Waktu lelang sudah berakhir' };
  }
  if (listing.sellerId === userId) return { success: false, error: 'Kamu tidak bisa menawar kartumu sendiri' };

  const amount = parseInt(bidAmount, 10);
  const minRequiredBid = listing.bidsCount === 0 ? listing.startingBid : (listing.currentBid + MIN_BID_INCREMENT);

  if (isNaN(amount) || amount < minRequiredBid) {
    return { success: false, error: `Tawaran minimal adalah ${minRequiredBid.toLocaleString()} Koin` };
  }

  // Jika tawaran mencapai atau melampaui harga Buyout -> langsung jadikan Buyout
  if (listing.buyoutPrice && amount >= listing.buyoutPrice) {
    return buyoutMarketListing(redis, userId, { listingId });
  }

  // Kurangi koin dari penawar baru
  const deducted = await deductCoinsFromUser(redis, userId, amount);
  if (!deducted) return { success: false, error: 'Koin kamu tidak cukup untuk menawar' };

  // Refund koin ke penawar tertinggi sebelumnya jika ada
  if (listing.highestBidderId && listing.highestBidderId !== userId) {
    await addCoinsToUser(redis, listing.highestBidderId, listing.currentBid);
  }

  const bidder = await getUserBrief(redis, userId);
  listing.currentBid = amount;
  listing.highestBidderId = userId;
  listing.highestBidderName = bidder.name;
  listing.bidsCount = (listing.bidsCount || 0) + 1;

  // Catat riwayat bid
  const bidRecord = {
    bidderId: userId,
    bidderName: bidder.name,
    amount,
    timestamp: Date.now()
  };

  await Promise.all([
    redis.set(listingKey(listingId), JSON.stringify(listing)),
    redis.lpush(listingBidsKey(listingId), JSON.stringify(bidRecord)),
    redis.sadd(userBidsKey(userId), listingId)
  ]);

  return { success: true, listing, currentBid: amount };
}

// ===== 3. BELI LANGSUNG (BUYOUT) =====
export async function buyoutMarketListing(redis, userId, { listingId }) {
  const rawList = await redis.get(listingKey(listingId));
  if (!rawList) return { success: false, error: 'Listing tidak ditemukan' };
  const listing = typeof rawList === 'string' ? JSON.parse(rawList) : rawList;

  if (listing.status !== 'active') return { success: false, error: 'Listing ini sudah tidak aktif' };
  if (!listing.buyoutPrice) return { success: false, error: 'Listing ini tidak memiliki opsi Beli Langsung' };
  if (listing.sellerId === userId) return { success: false, error: 'Kamu tidak bisa membeli kartumu sendiri' };

  const price = listing.buyoutPrice;

  // Kurangi koin dari pembeli
  const deducted = await deductCoinsFromUser(redis, userId, price);
  if (!deducted) return { success: false, error: `Koin kamu tidak cukup (Butuh ${price.toLocaleString()} Koin)` };

  // Refund koin ke penawar tertinggi sebelumnya jika ada
  if (listing.highestBidderId && listing.highestBidderId !== userId) {
    await addCoinsToUser(redis, listing.highestBidderId, listing.currentBid);
  }

  // Kirim koin ke penjual
  await addCoinsToUser(redis, listing.sellerId, price);

  // Transfer kartu ke inventory pembeli
  const cardDef = getCardById(listing.cardId);
  await addCardsToUser(redis, userId, [{ card: cardDef }]);

  // Tandai listing sebagai terjual
  const buyer = await getUserBrief(redis, userId);
  listing.status = 'sold';
  listing.soldToId = userId;
  listing.soldToName = buyer.name;
  listing.soldPrice = price;
  listing.soldAt = Date.now();

  await Promise.all([
    redis.set(listingKey(listingId), JSON.stringify(listing)),
    redis.zrem(MARKET_LISTINGS_ZSET, listingId)
  ]);

  return { success: true, listing, card: cardDef, price };
}

// ===== 4. BATALKAN LISTING (JIKA BELUM ADA BID) =====
export async function cancelMarketListing(redis, userId, { listingId }) {
  const rawList = await redis.get(listingKey(listingId));
  if (!rawList) return { success: false, error: 'Listing tidak ditemukan' };
  const listing = typeof rawList === 'string' ? JSON.parse(rawList) : rawList;

  if (listing.sellerId !== userId) return { success: false, error: 'Hanya pemilik listing yang bisa membatalkan' };
  if (listing.status !== 'active') return { success: false, error: 'Listing sudah tidak aktif' };
  if (listing.bidsCount > 0) return { success: false, error: 'Listing yang sudah memiliki penawaran tidak bisa dibatalkan' };

  // Kembalikan kartu dari Escrow ke penjual
  const cardDef = getCardById(listing.cardId);
  await addCardsToUser(redis, userId, [{ card: cardDef }]);

  listing.status = 'cancelled';
  listing.cancelledAt = Date.now();

  await Promise.all([
    redis.set(listingKey(listingId), JSON.stringify(listing)),
    redis.zrem(MARKET_LISTINGS_ZSET, listingId)
  ]);

  return { success: true, listing };
}

// Helper Proses Lelang Selesai Saat Expired
async function processExpiredListing(redis, listing) {
  if (listing.status !== 'active') return listing;

  const cardDef = getCardById(listing.cardId);

  if (listing.highestBidderId && listing.currentBid > 0) {
    // Ada pemenang lelang!
    // Kirim kartu ke pemenang
    await addCardsToUser(redis, listing.highestBidderId, [{ card: cardDef }]);
    // Kirim koin ke penjual
    await addCoinsToUser(redis, listing.sellerId, listing.currentBid);

    listing.status = 'sold';
    listing.soldToId = listing.highestBidderId;
    listing.soldToName = listing.highestBidderName;
    listing.soldPrice = listing.currentBid;
    listing.soldAt = Date.now();
  } else {
    // Tidak ada penawar -> kembalikan kartu ke penjual
    await addCardsToUser(redis, listing.sellerId, [{ card: cardDef }]);
    listing.status = 'expired';
    listing.expiredAt = Date.now();
  }

  await Promise.all([
    redis.set(listingKey(listing.id), JSON.stringify(listing)),
    redis.zrem(MARKET_LISTINGS_ZSET, listing.id)
  ]);

  return listing;
}

// ===== 5. BROWSE & FILTER LISTING AKTIF =====
export async function getMarketListings(redis, { rarity, element, sort = 'ending_soon', search = '', page = 0, limit = 20 }) {
  const now = Date.now();
  const allIds = await redis.zrange(MARKET_LISTINGS_ZSET, 0, 150);

  const rawListings = await Promise.all(allIds.map((id) => redis.get(listingKey(id))));
  const listings = [];

  for (const raw of rawListings) {
    if (!raw) continue;
    let item = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Cek apakah lelang sudah lewat masa aktif
    if (item.status === 'active' && now >= item.expiresAt) {
      item = await processExpiredListing(redis, item);
    }

    if (item.status === 'active') {
      listings.push(item);
    }
  }

  // Filter Rarity & Element & Search
  let filtered = listings.filter((l) => {
    if (rarity && rarity !== 'ALL' && l.card?.rarity !== rarity) return false;
    if (element && element !== 'ALL' && l.card?.element !== element) return false;
    if (search && search.trim()) {
      const q = search.toLowerCase();
      const matchName = l.card?.name?.toLowerCase().includes(q);
      const matchAnime = l.card?.anime?.toLowerCase().includes(q);
      const matchSeller = l.sellerName?.toLowerCase().includes(q);
      if (!matchName && !matchAnime && !matchSeller) return false;
    }
    return true;
  });

  // Sorting
  if (sort === 'price_low') {
    filtered.sort((a, b) => (a.buyoutPrice || a.currentBid) - (b.buyoutPrice || b.currentBid));
  } else if (sort === 'price_high') {
    filtered.sort((a, b) => (b.buyoutPrice || b.currentBid) - (a.buyoutPrice || a.currentBid));
  } else if (sort === 'bids_high') {
    filtered.sort((a, b) => (b.bidsCount || 0) - (a.bidsCount || 0));
  } else if (sort === 'newest') {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    // ending_soon (default)
    filtered.sort((a, b) => a.expiresAt - b.expiresAt);
  }

  const offset = page * limit;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    success: true,
    total: filtered.length,
    page,
    limit,
    listings: paginated
  };
}

// ===== 6. AKTIVITAS & KARTU SAYA (MY LISTINGS & BIDS) =====
export async function getMyMarketActivity(redis, userId) {
  const [listingIds, bidIds, userCardsRaw, gStats] = await Promise.all([
    redis.smembers(userListingsKey(userId)),
    redis.smembers(userBidsKey(userId)),
    redis.get(userCardsKey(userId)),
    redis.get(gachaStatsKey(userId))
  ]);

  const rawListings = await Promise.all((listingIds || []).map((id) => redis.get(listingKey(id))));
  const rawBidded = await Promise.all((bidIds || []).map((id) => redis.get(listingKey(id))));

  const myListings = rawListings.filter(Boolean).map((r) => typeof r === 'string' ? JSON.parse(r) : r);
  const myBids = rawBidded.filter(Boolean).map((r) => typeof r === 'string' ? JSON.parse(r) : r);

  const userCards = userCardsRaw ? (typeof userCardsRaw === 'string' ? JSON.parse(userCardsRaw) : userCardsRaw) : {};
  const cardsList = Object.values(userCards).map((c) => ({
    ...getCardById(c.id),
    ...c
  })).filter(Boolean);

  const stats = gStats ? (typeof gStats === 'string' ? JSON.parse(gStats) : gStats) : { coins: 0 };

  return {
    success: true,
    myListings,
    myBids,
    myCards: cardsList,
    coins: stats.coins || 0
  };
}

// ===== 7. DIRECT TRADE / BARTER KARTU DENGAN TEMAN =====
export async function createDirectTradeOffer(redis, userId, { targetUserId, senderCardId, requestedCardId }) {
  if (userId === targetUserId) return { success: false, error: 'Kamu tidak bisa barter dengan dirimu sendiri' };

  const [senderCardsRaw, targetCardsRaw, sender, target] = await Promise.all([
    redis.get(userCardsKey(userId)),
    redis.get(userCardsKey(targetUserId)),
    getUserBrief(redis, userId),
    getUserBrief(redis, targetUserId)
  ]);

  const senderCards = senderCardsRaw ? (typeof senderCardsRaw === 'string' ? JSON.parse(senderCardsRaw) : senderCardsRaw) : {};
  const targetCards = targetCardsRaw ? (typeof targetCardsRaw === 'string' ? JSON.parse(targetCardsRaw) : targetCardsRaw) : {};

  if (!senderCards[senderCardId] || senderCards[senderCardId].count < 1) {
    return { success: false, error: 'Kamu tidak memiliki kartu yang ditawarkan' };
  }
  if (!targetCards[requestedCardId] || targetCards[requestedCardId].count < 1) {
    return { success: false, error: 'Temanmu tidak memiliki kartu yang kamu minta' };
  }

  const senderCard = getCardById(senderCardId);
  const requestedCard = getCardById(requestedCardId);

  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const expiresAt = now + 48 * 3600 * 1000; // 48 jam

  const offer = {
    id: tradeId,
    senderId: userId,
    senderName: sender.name,
    senderAvatar: sender.picture,
    senderCard,
    targetUserId,
    targetUserName: target.name,
    targetUserAvatar: target.picture,
    requestedCard,
    status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'cancelled'
    createdAt: now,
    expiresAt
  };

  await Promise.all([
    redis.set(tradeKey(tradeId), JSON.stringify(offer), { ex: 172800 }),
    redis.sadd(userSentTradesKey(userId), tradeId),
    redis.sadd(userReceivedTradesKey(targetUserId), tradeId)
  ]);

  return { success: true, offer };
}

// ===== 8. RESPON TRADE OFFER (TERIMA / TOLAK) =====
export async function respondTradeOffer(redis, userId, { tradeId, accept }) {
  const raw = await redis.get(tradeKey(tradeId));
  if (!raw) return { success: false, error: 'Tawaran barter tidak ditemukan atau sudah kadaluarsa' };
  const offer = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (offer.targetUserId !== userId) {
    return { success: false, error: 'Hanya penerima tawaran yang bisa merespons barter ini' };
  }
  if (offer.status !== 'pending') {
    return { success: false, error: `Tawaran ini sudah berstatus: ${offer.status}` };
  }

  if (!accept) {
    offer.status = 'rejected';
    await redis.set(tradeKey(tradeId), JSON.stringify(offer), { ex: 86400 });
    return { success: true, status: 'rejected' };
  }

  // Cek kembali ketersediaan kartu kedua belah pihak secara atomik
  const senderHasCard = await deductCardFromUser(redis, offer.senderId, offer.senderCard.id);
  if (!senderHasCard) {
    offer.status = 'cancelled';
    await redis.set(tradeKey(tradeId), JSON.stringify(offer));
    return { success: false, error: 'Pengirim barter sudah tidak memiliki kartu tersebut' };
  }

  const targetHasCard = await deductCardFromUser(redis, offer.targetUserId, offer.requestedCard.id);
  if (!targetHasCard) {
    // Kembalikan kartu pengirim
    await addCardsToUser(redis, offer.senderId, [{ card: offer.senderCard }]);
    offer.status = 'cancelled';
    await redis.set(tradeKey(tradeId), JSON.stringify(offer));
    return { success: false, error: 'Kamu sudah tidak memiliki kartu yang diminta' };
  }

  // Tukar kartu!
  await Promise.all([
    addCardsToUser(redis, offer.targetUserId, [{ card: offer.senderCard }]),
    addCardsToUser(redis, offer.senderId, [{ card: offer.requestedCard }])
  ]);

  offer.status = 'accepted';
  offer.acceptedAt = Date.now();
  await redis.set(tradeKey(tradeId), JSON.stringify(offer), { ex: 86400 });

  return { success: true, status: 'accepted', offer };
}

// ===== 9. GET USER TRADES (SENT & RECEIVED) =====
export async function getMyTrades(redis, userId) {
  const [sentIds, receivedIds] = await Promise.all([
    redis.smembers(userSentTradesKey(userId)),
    redis.smembers(userReceivedTradesKey(userId))
  ]);

  const rawSent = await Promise.all((sentIds || []).map((id) => redis.get(tradeKey(id))));
  const rawReceived = await Promise.all((receivedIds || []).map((id) => redis.get(tradeKey(id))));

  const sent = rawSent.filter(Boolean).map((r) => typeof r === 'string' ? JSON.parse(r) : r);
  const received = rawReceived.filter(Boolean).map((r) => typeof r === 'string' ? JSON.parse(r) : r);

  return {
    success: true,
    sent,
    received
  };
}
