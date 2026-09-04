import { verifyUserId } from '../_lib/auth.js';
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  getRaidStatus,
  getRaidLeaderboard,
  attackWorldBoss,
  claimRaidMilestone
} from '../_lib/raid.js';

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
    // ===== 1. GET /api/v1/raid/status =====
    if (action === 'status' && req.method === 'GET') {
      const result = await getRaidStatus(redis, userId);
      return res.status(200).json(result);
    }

    // ===== 2. GET /api/v1/raid/leaderboard =====
    if (action === 'leaderboard' && req.method === 'GET') {
      const result = await getRaidLeaderboard(redis);
      return res.status(200).json(result);
    }

    // Aksi di bawah ini butuh login
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Kamu harus login terlebih dahulu' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // ===== 3. POST /api/v1/raid/attack =====
    if (action === 'attack' && req.method === 'POST') {
      const result = await attackWorldBoss(redis, userId);
      return res.status(result.success ? 200 : 400).json(result);
    }

    // ===== 4. POST /api/v1/raid/claim-milestone =====
    if (action === 'claim-milestone' && req.method === 'POST') {
      const { milestoneId } = body;
      const result = await claimRaidMilestone(redis, userId, milestoneId);
      return res.status(result.success ? 200 : 400).json(result);
    }

    return res.status(404).json({ success: false, error: 'Aksi raid tidak ditemukan' });
  } catch (err) {
    console.error('Raid API error:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan server raid' });
  }
}
