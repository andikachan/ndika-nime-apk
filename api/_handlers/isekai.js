import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  getUserIsekaiPassport,
  claimIsekaiRealm,
  ISEKAI_REALMS
} from '../_lib/isekai.js';

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
    // Katalog statis wilayah
    if (action === 'realms' && req.method === 'GET') {
      return res.status(200).json({ success: true, realms: ISEKAI_REALMS });
    }
    // ===== 1. GET /api/v1/isekai/passport (bisa lihat profil user lain) =====
    if (action === 'passport' && req.method === 'GET') {
      const targetUserId = req.query.userId || userId;
      if (!targetUserId) {
        return res.status(401).json({ success: false, error: 'User tidak ditemukan' });
      }
      const result = await getUserIsekaiPassport(redis, targetUserId);
      return res.status(200).json(result);
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Kamu harus login terlebih dahulu' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // ===== 2. POST /api/v1/isekai/claim-realm =====
    if (action === 'claim-realm' && req.method === 'POST') {
      const { realmId } = body;
      const result = await claimIsekaiRealm(redis, userId, realmId);
      return res.status(result.success ? 200 : 400).json(result);
    }

    return res.status(404).json({ success: false, error: 'Aksi isekai tidak ditemukan' });
  } catch (err) {
    console.error('Isekai API error:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan server isekai' });
  }
}
