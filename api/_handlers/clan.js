import { verifyUserId } from '../_lib/auth.js';
// /api/v1/clan/:action
import redis from '../_lib/redis.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import {
  createClan, listClans, getClanDetail, getMyClan, joinClan, requestJoin, cancelRequest,
  respondRequest, inviteUser, getMyInvites, respondInvite, leaveClan, kickMember, changeRole,
  transferLeadership, disbandClan, editClan, donateExp, claimDaily, giveExpDirect,
  pullGacha, activateCosmetic, getClanChat, sendClanChat, getClanActivity, syncMemberContribution,
  getUserClanId, getClanBadge, regenerateInviteCode, joinByInviteCode, warChallenge, warRespond, warCancel,
  setMemberTitle, buyClanBuff, getClanExpeditions, deployExpeditionSquad, claimExpeditionReward, warAutoMatchmake,
  CLAN_ICONS, CLAN_COLORS, CLAN_FRAMES, GACHA_POOL, GACHA_COST, CLAN_BUFFS, EXPEDITION_DUNGEONS
} from '../_lib/clan.js';

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
    // ===== GET /api/v1/clan/meta =====
    // Katalog statis (icon/warna pilihan, pool gacha) buat form create & UI gacha.
    if (action === 'meta' && req.method === 'GET') {
      return res.json({ success: true, icons: CLAN_ICONS, colors: CLAN_COLORS, frames: CLAN_FRAMES, gachaPool: GACHA_POOL, gachaCost: GACHA_COST });
    }

    // ===== GET /api/v1/clan/badge?userId= =====
    // Dipakai di halaman profil buat nampilin badge clan user yang dilihat.
    if (action === 'badge' && req.method === 'GET') {
      const { userId: targetId } = req.query;
      if (!targetId) return res.status(400).json({ success: false, error: 'userId wajib diisi' });
      const badge = await getClanBadge(redis, targetId);
      return res.json({ success: true, badge });
    }

    // ===== GET /api/v1/clan/list =====
    if (action === 'list' && req.method === 'GET') {
      const { q = '', sort = 'level', page = '0' } = req.query;
      const result = await listClans(redis, { q, sort, page: parseInt(page, 10) || 0 });
      return res.json(result);
    }

    // ===== GET /api/v1/clan/detail?id= =====
    if (action === 'detail' && req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id wajib diisi' });
      if (userId) {
        const myClanId = await getUserClanId(redis, userId);
        if (myClanId === id) await syncMemberContribution(redis, id, userId);
      }
      const result = await getClanDetail(redis, id);
      return res.json(result);
    }

    // Semua action di bawah ini butuh login.
    if (!userId) return res.status(401).json({ success: false, error: 'Kamu harus login' });

    // ===== GET /api/v1/clan/mine =====
    if (action === 'mine' && req.method === 'GET') {
      const result = await getMyClan(redis, userId);
      return res.json(result);
    }

    // ===== GET /api/v1/clan/invites =====
    if (action === 'invites' && req.method === 'GET') {
      const result = await getMyInvites(redis, userId);
      return res.json(result);
    }

    // ===== GET /api/v1/clan/chat?id= =====
    if (action === 'chat' && req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id wajib diisi' });
      const result = await getClanChat(redis, userId, id);
      return res.json(result);
    }

    // ===== GET /api/v1/clan/activity?id= =====
    if (action === 'activity' && req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id wajib diisi' });
      const result = await getClanActivity(redis, userId, id);
      return res.json(result);
    }

    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const body = req.body || {};

    if (action === 'create') {
      const result = await createClan(redis, userId, body);
      return res.json(result);
    }
    if (action === 'join') {
      const result = await joinClan(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'request') {
      const result = await requestJoin(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'cancel-request') {
      const result = await cancelRequest(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'approve') {
      const result = await respondRequest(redis, userId, body.clanId, body.userId, true);
      return res.json(result);
    }
    if (action === 'reject') {
      const result = await respondRequest(redis, userId, body.clanId, body.userId, false);
      return res.json(result);
    }
    if (action === 'invite') {
      const result = await inviteUser(redis, userId, body.clanId, body.userId);
      return res.json(result);
    }
    if (action === 'accept-invite') {
      const result = await respondInvite(redis, userId, body.clanId, true);
      return res.json(result);
    }
    if (action === 'decline-invite') {
      const result = await respondInvite(redis, userId, body.clanId, false);
      return res.json(result);
    }
    if (action === 'leave') {
      const result = await leaveClan(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'kick') {
      const result = await kickMember(redis, userId, body.clanId, body.userId);
      return res.json(result);
    }
    if (action === 'role') {
      const result = await changeRole(redis, userId, body.clanId, body.userId, body.role);
      return res.json(result);
    }
    if (action === 'transfer') {
      const result = await transferLeadership(redis, userId, body.clanId, body.userId);
      return res.json(result);
    }
    if (action === 'disband') {
      const result = await disbandClan(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'edit') {
      const result = await editClan(redis, userId, body.clanId, body);
      return res.json(result);
    }
    if (action === 'regenerate-invite') {
      const result = await regenerateInviteCode(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'join-by-code') {
      const result = await joinByInviteCode(redis, userId, body.code);
      return res.json(result);
    }
    if (action === 'donate') {
      const result = await donateExp(redis, userId, body.clanId, body.amount);
      return res.json(result);
    }
    if (action === 'give-exp-direct') {
      const result = await giveExpDirect(redis, userId, body.targetUserId, body.amount);
      return res.json(result);
    }
    if (action === 'claim-daily') {
      const result = await claimDaily(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'gacha') {
      const result = await pullGacha(redis, userId, body.clanId, body.count);
      return res.json(result);
    }
    if (action === 'activate') {
      const result = await activateCosmetic(redis, userId, body.clanId, body.type, body.itemId);
      return res.json(result);
    }
    if (action === 'chat-send') {
      const result = await sendClanChat(redis, userId, body.clanId, body.text);
      return res.json(result);
    }
    if (action === 'war-challenge') {
      const result = await warChallenge(redis, userId, body.clanId, body.targetTag);
      return res.json(result);
    }
    if (action === 'war-respond') {
      const result = await warRespond(redis, userId, body.clanId, !!body.accept);
      return res.json(result);
    }
    if (action === 'war-cancel') {
      const result = await warCancel(redis, userId, body.clanId);
      return res.json(result);
    }
    if (action === 'set-title') {
      const result = await setMemberTitle(redis, userId, body.clanId, body.userId, body.title);
      return res.json(result);
    }
    if (action === 'buy-buff') {
      const result = await buyClanBuff(redis, userId, body.clanId, body.buffId);
      return res.json(result);
    }
    if (action === 'expeditions') {
      const { clanId } = req.query;
      const result = await getClanExpeditions(redis, userId, clanId || body?.clanId);
      return res.json(result);
    }
    if (action === 'expedition-deploy') {
      const result = await deployExpeditionSquad(redis, userId, body.clanId, body.dungeonId);
      return res.json(result);
    }
    if (action === 'expedition-claim') {
      const result = await claimExpeditionReward(redis, userId, body.clanId, body.dungeonId);
      return res.json(result);
    }
    if (action === 'war-matchmake') {
      const result = await warAutoMatchmake(redis, userId, body.clanId);
      return res.json(result);
    }

    return res.status(404).json({ success: false, error: 'Action tidak ditemukan' });
  } catch (err) {
    console.error('❌ /api/v1/clan error:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan server' });
  }
}
