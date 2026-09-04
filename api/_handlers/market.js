import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  createMarketListing,
  placeMarketBid,
  buyoutMarketListing,
  cancelMarketListing,
  getMarketListings,
  getMyMarketActivity,
  createDirectTradeOffer,
  respondTradeOffer,
  getMyTrades
} from '../_lib/market.js';

// redis singleton from _lib/redis.js

// verifyUserId imported from _lib/auth.js

export default async function handler(req, res) {
  const { action } = req.query;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyUserId(req);

  try {
    // ===== 1. GET /api/v1/market/listings =====
    if (action === 'listings' && req.method === 'GET') {
      const { rarity, element, sort, search, page, limit } = req.query;
      const result = await getMarketListings(redis, {
        rarity,
        element,
        sort,
        search,
        page: parseInt(page, 10) || 0,
        limit: parseInt(limit, 10) || 24
      });
      return res.status(200).json(result);
    }

    // Seluruh aksi di bawah ini butuh login
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Kamu harus login terlebih dahulu' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // ===== 2. POST /api/v1/market/create-listing =====
    if (action === 'create-listing' && req.method === 'POST') {
      const { cardId, startingBid, buyoutPrice, durationHours } = body;
      const result = await createMarketListing(redis, userId, {
        cardId,
        startingBid,
        buyoutPrice,
        durationHours
      });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 3. POST /api/v1/market/place-bid =====
    if (action === 'place-bid' && req.method === 'POST') {
      const { listingId, bidAmount } = body;
      const result = await placeMarketBid(redis, userId, { listingId, bidAmount });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 4. POST /api/v1/market/buyout =====
    if (action === 'buyout' && req.method === 'POST') {
      const { listingId } = body;
      const result = await buyoutMarketListing(redis, userId, { listingId });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 5. POST /api/v1/market/cancel-listing =====
    if (action === 'cancel-listing' && req.method === 'POST') {
      const { listingId } = body;
      const result = await cancelMarketListing(redis, userId, { listingId });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 6. GET /api/v1/market/my-activity =====
    if (action === 'my-activity' && req.method === 'GET') {
      const result = await getMyMarketActivity(redis, userId);
      return res.status(200).json(result);
    }

    // ===== 7. POST /api/v1/market/send-trade =====
    if (action === 'send-trade' && req.method === 'POST') {
      const { targetUserId, senderCardId, requestedCardId } = body;
      const result = await createDirectTradeOffer(redis, userId, {
        targetUserId,
        senderCardId,
        requestedCardId
      });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 8. POST /api/v1/market/respond-trade =====
    if (action === 'respond-trade' && req.method === 'POST') {
      const { tradeId, accept } = body;
      const result = await respondTradeOffer(redis, userId, { tradeId, accept: !!accept });
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 9. GET /api/v1/market/my-trades =====
    if (action === 'my-trades' && req.method === 'GET') {
      const result = await getMyTrades(redis, userId);
      return res.status(200).json(result);
    }

    return res.status(404).json({ success: false, error: 'Aksi pasar tidak ditemukan' });
  } catch (err) {
    console.error('Market API error:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan server pasar' });
  }
}
