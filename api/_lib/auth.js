import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import redis from './redis.js';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
    }
    console.warn('[Security Warning] JWT_SECRET is not defined. Using temporary dev secret.');
    return 'dev-only-jwt-secret-do-not-use-in-production';
  }
  return secret;
};

export const SUPER_ADMIN_IDS = process.env.ADMIN_USER_IDS 
  ? process.env.ADMIN_USER_IDS.split(',').map(s => s.trim()).filter(Boolean) 
  : [];

export const getTokenFromRequest = (req) => {
  if (!req) return null;
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // 2. Check Cookie
  if (req.headers?.cookie) {
    try {
      const parsed = cookie.parse(req.headers.cookie);
      if (parsed.token) return parsed.token;
    } catch {
      return null;
    }
  }
  return null;
};

export const verifyUserId = (req) => {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
};

export const verifyToken = (req) => {
  const token = getTokenFromRequest(req);
  if (!token) throw new Error('No token provided');
  const decoded = jwt.verify(token, getJwtSecret());
  const userId = decoded.userId || decoded.id;
  if (!userId) throw new Error('Invalid token payload');
  return userId;
};

export const checkIsAdmin = async (userId) => {
  if (!userId) return false;
  if (SUPER_ADMIN_IDS.includes(String(userId))) return true;
  try {
    const adminData = await redis.get('admin:ids');
    if (adminData) {
      const ids = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
      if (Array.isArray(ids) && ids.map(String).includes(String(userId))) {
        return true;
      }
    }
  } catch (err) {
    console.error('Error checking admin status:', err);
  }
  return false;
};
