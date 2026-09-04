import adminHandler from './_handlers/admin.js';
import arenaHandler from './_handlers/arena.js';
import authHandler from './_handlers/auth.js';
import clanHandler from './_handlers/clan.js';
import cronBackupHandler from './_handlers/cronBackup.js';
import cronNotifyHandler from './_handlers/cronNotify.js';
import dmHandler from './_handlers/dm.js';
import gachaHandler from './_handlers/gacha.js';
import historyHandler from './_handlers/history.js';
import isekaiHandler from './_handlers/isekai.js';
import marketHandler from './_handlers/market.js';
import questsHandler from './_handlers/quests.js';
import raidHandler from './_handlers/raid.js';
import socialHandler from './_handlers/social.js';
import storyHandler from './_handlers/story.js';
import tournamentHandler from './_handlers/tournament.js';
import triviaHandler from './_handlers/trivia.js';
import userHandler from './_handlers/user.js';
import w2gHandler from './_handlers/w2g.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path dari query param _path atau req.url
  let pathStr = '';
  if (req.query?._path) {
    pathStr = Array.isArray(req.query._path) ? req.query._path.join('/') : req.query._path;
  } else {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      pathStr = urlObj.pathname
        .replace(/^\/api\/v1\//, '')
        .replace(/^\/api\//, '')
        .replace(/^\//, '');
    } catch {
      pathStr = '';
    }
  }

  // Clean path
  pathStr = pathStr.replace(/^\/+|\/+$/g, '');

  // Handle sitemap.xml
  if (pathStr === 'sitemap' || pathStr === 'sitemap.xml' || req.url?.includes('sitemap.xml')) {
    req.query = req.query || {};
    req.query.action = 'sitemap';
    return userHandler(req, res);
  }

  const segments = pathStr.split('/').filter(Boolean);
  const moduleName = segments[0] || '';
  const actionSegments = segments.slice(1);
  const actionName = actionSegments[0] || '';

  // Isi req.query.action untuk handler downstream
  req.query = req.query || {};
  if (!req.query.action && actionName) {
    req.query.action = actionSegments.length > 1 ? actionSegments.join('/') : actionName;
  }

  try {
    switch (moduleName) {
      case 'auth':
        return await authHandler(req, res);

      case 'user':
        // Cek sub history jika pola url /api/v1/user/:userId/history
        if (actionSegments[1] === 'history') {
          req.query.sub = 'history';
          req.query.action = actionSegments[0];
        }
        return await userHandler(req, res);

      case 'gacha':
        return await gachaHandler(req, res);

      case 'arena':
        return await arenaHandler(req, res);

      case 'tournament':
        return await tournamentHandler(req, res);

      case 'market':
        return await marketHandler(req, res);

      case 'raid':
        return await raidHandler(req, res);

      case 'isekai':
        return await isekaiHandler(req, res);

      case 'quests':
        return await questsHandler(req, res);

      case 'clan':
        return await clanHandler(req, res);

      case 'dm':
        return await dmHandler(req, res);

      case 'social':
        return await socialHandler(req, res);

      case 'story':
        return await storyHandler(req, res);

      case 'trivia':
        return await triviaHandler(req, res);

      case 'admin':
        return await adminHandler(req, res);

      case 'history':
        return await historyHandler(req, res);

      case 'w2g':
        return await w2gHandler(req, res);

      case 'cron':
        if (actionName === 'backup') {
          return await cronBackupHandler(req, res);
        }
        if (actionName === 'notify') {
          return await cronNotifyHandler(req, res);
        }
        return res.status(404).json({ error: 'Aksi cron tidak ditemukan' });

      default:
        return res.status(404).json({ error: `API route tidak ditemukan: /${pathStr}` });
    }
  } catch (err) {
    console.error(`API Error in module [${moduleName}]:`, err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
