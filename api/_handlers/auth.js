import {
    OAuth2Client
} from 'google-auth-library';
import cookie from 'cookie';
import redis from '../_lib/redis.js';
import { getJwtSecret, verifyUserId, getTokenFromRequest } from '../_lib/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getTransporter } from '../_lib/mailer.js';

// ===== EMAIL TEMPLATE + SENDER (digabung dari gmailapi, pakai env vars) =====
function buildVerificationEmailHtml({ code, name }) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NdiChan - Kode Verifikasi</title>
      <style>
        body {
          background-color: #0a0a0c;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #ffffff;
        }
        .container {
          max-width: 560px;
          margin: 40px auto;
          background: linear-gradient(145deg, #16161a, #1a1a1e);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        }
        .header {
          background: linear-gradient(135deg, #0a0a0c 0%, #16161a 100%);
          padding: 30px 30px 20px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
        }
        .header img {
          width: 60px;
          height: 60px;
          object-fit: contain;
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #F6CF80, #f0b84d);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
          font-weight: 500;
        }
        .content {
          padding: 40px 30px 35px;
          text-align: center;
        }
        .greeting {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .greeting span {
          color: #F6CF80;
        }
        .sub-greeting {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          margin: 0 0 25px;
          font-weight: 400;
        }
        .code-box {
          background: rgba(246, 207, 128, 0.05);
          border: 2px solid rgba(246, 207, 128, 0.15);
          border-radius: 16px;
          padding: 20px 10px;
          margin: 20px 0 25px;
          position: relative;
        }
        .code {
          font-size: 38px;
          letter-spacing: 10px;
          font-weight: 800;
          color: #F6CF80;
          font-family: 'Courier New', monospace;
        }
        .code-label {
          display: inline-block;
          background: rgba(246, 207, 128, 0.1);
          color: #F6CF80;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          padding: 4px 14px;
          border-radius: 20px;
          margin-bottom: 12px;
        }
        .info-text {
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 5px;
        }
        .info-text strong {
          color: #F6CF80;
          font-weight: 600;
        }
        .warning {
          background: rgba(255, 59, 48, 0.05);
          border: 1px solid rgba(255, 59, 48, 0.1);
          border-radius: 12px;
          padding: 14px 20px;
          margin: 25px 0 0;
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
        }
        .warning-text {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          font-weight: 500;
          margin: 0;
        }
        .footer {
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 20px 30px;
          text-align: center;
        }
        .footer p {
          color: rgba(255, 255, 255, 0.2);
          font-size: 11px;
          margin: 0;
          line-height: 1.8;
        }
        .footer .brand {
          color: #F6CF80;
          font-weight: 600;
          opacity: 0.6;
        }
        .divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #F6CF80, transparent);
          margin: 0 auto 20px;
          border-radius: 2px;
          opacity: 0.3;
        }
        @media (max-width: 600px) {
          .container { margin: 20px; border-radius: 16px; }
          .content { padding: 30px 20px; }
          .code { font-size: 30px; letter-spacing: 8px; }
          .header h1 { font-size: 24px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg" alt="NdiChan Logo" />
          <h1>✦ Ndirfora</h1>
          <p>Anime Streaming Platform</p>
        </div>
        <div class="content">
          <p class="greeting">Halo, <span>${name || 'Anime Lover'}</span> 👋</p>
          <p class="sub-greeting">Kode verifikasi untuk melanjutkan proses</p>
          <div class="divider"></div>
          <div class="code-box">
            <div class="code-label">✦ Kode Verifikasi</div>
            <div class="code">${code}</div>
          </div>
          <p class="info-text">⏱️ Kode ini berlaku selama <strong>10 menit</strong></p>
          <p class="info-text">Jangan bagikan kode ini kepada siapa pun</p>
          <div class="warning">
            <span class="warning-icon">🔒</span>
            <p class="warning-text">Jika Anda tidak meminta kode ini, abaikan email ini</p>
          </div>
        </div>
        <div class="footer">
          <p>
            Email ini dikirim secara otomatis oleh <span class="brand">NdiChan</span><br>
            &copy; ${new Date().getFullYear()} NdiChan. All rights reserved.
          </p>
          <p style="margin-top: 8px; opacity: 0.15; font-size: 10px;">
            ${new Date().toLocaleString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Transporter & alamat pengirim sekarang diambil dari pengaturan email yang
// bisa diatur admin lewat panel (lihat api/_lib/mailer.js), fallback ke ENV
// vars kalau admin belum pernah mengatur apa-apa lewat panel.
async function sendVerificationEmail({ to, subject, code, name }) {
    const { transporter, from } = await getTransporter();
    const html = buildVerificationEmailHtml({ code, name });

    return transporter.sendMail({
        from: `"NdiChan" <${from || 'ndika@tjkthree.xyz'}>`,
        to,
        subject,
        html,
    });
}

export default async function handler(req, res) {
    const {
        action
    } = req.query;

    if (action === 'google') {
        // Handle Google OAuth - hanya GET
        if (req.method !== 'GET') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        const oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.FRONTEND_URL ? process.env.FRONTEND_URL : 'http://localhost:5173'}/api/v1/auth/callback`
        );

        const authorizeUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
        });

        res.redirect(authorizeUrl);
    } else if (action === 'logout') {
        // Handle Logout - support POST dan GET
        if (req.method !== 'POST' && req.method !== 'GET') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        res.setHeader('Set-Cookie', cookie.serialize('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        }));

        res.status(200).json({
            success: true
        });
    } else if (action === 'me') {
       // redis singleton used

const SUPER_ADMIN_IDS = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];

// ===== TITLES =====
const TITLES = [
  { level: 0, name: 'Anime Newbie' },
  { level: 5, name: 'Anime Watcher' },
  { level: 10, name: 'Anime Lover' },
  { level: 20, name: 'Anime Enthusiast' },
  { level: 30, name: 'Anime Master' },
  { level: 50, name: 'Anime Legend' },
  { level: 75, name: 'Anime God' },
  { level: 100, name: 'Anime Supreme' },
  { level: 150, name: 'Anime Overlord' },
  { level: 200, name: 'Anime Emperor' },
  { level: 300, name: 'Anime Immortal' },
  { level: 500, name: 'Anime Universe' },
  { level: 1000, name: 'Anime Creator' }
];

// ===== FUNGSI GET TITLE DARI LEVEL =====
function getTitleByLevel(level) {
  let title = 'Anime Newbie';
  for (const t of TITLES) {
    if (level >= t.level) {
      title = t.name;
    }
  }
  return title;
}

// ===== HELPER: Get admin IDs dari Redis =====
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
        res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated - No token' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded.userId;

    const userData = await redis.get(`user:${userId}`);

    if (!userData) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // ===== CEK ADMIN DARI REDIS admin:ids =====
    const adminIds = await getAdminIds();
    let isAdmin = adminIds.includes(userId);

    // Jika belum admin, cek dari SUPER_ADMIN_IDS
    if (!isAdmin) {
      isAdmin = SUPER_ADMIN_IDS.includes(userId);
    }

    // ===== UPDATE TITLE BERDASARKAN LEVEL =====
    const currentLevel = user.level || 0;
    const correctTitle = getTitleByLevel(currentLevel);

    // Jika title tidak sesuai dengan level, update
    let titleChanged = false;
    if (user.title !== correctTitle) {
      user.title = correctTitle;
      titleChanged = true;
    }

    // Jika admin, set level dan title admin
    if (isAdmin) {
      const ADMIN_LEVEL = 999;
      if (!user.level || user.level < ADMIN_LEVEL) {
        user.level = ADMIN_LEVEL;
        user.watchTime = ADMIN_LEVEL * 600;
        user.title = 'Admin NdiChan';
        user.isAdmin = true;

        await redis.zadd('leaderboard', { score: user.watchTime, member: userId });
        await redis.set(`user:${userId}`, JSON.stringify(user));
      } else {
        user.isAdmin = true;
        // Jika admin tapi title tidak sesuai, update
        if (user.title !== 'Admin NdiChan') {
          user.title = 'Admin NdiChan';
          await redis.set(`user:${userId}`, JSON.stringify(user));
        }
      }
    } else if (titleChanged) {
      // Jika bukan admin dan title berubah, save ke Redis
      await redis.set(`user:${userId}`, JSON.stringify(user));
    }

    res.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
    } else if (action === 'callback') {
        const { code } = req.query;
// redis singleton used

try {
    const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/v1/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        }
    );

    const userInfo = await userInfoResponse.json();

    // Cek apakah Google id ini sudah pernah dipakai login sebelumnya (mapping google -> userId akun final)
    const googleLinkKey = `user:google:${userInfo.id}`;
    const linkedUserId = await redis.get(googleLinkKey);

    // Kompatibel dengan akun google lama yang disimpan dengan id = userInfo.id langsung
    const directUserData = await redis.get(`user:${userInfo.id}`);

    // Cek apakah email ini sudah dipakai akun lain (misalnya akun yang daftar via email/password)
    const emailMapKey = `user:email:${(userInfo.email || '').toLowerCase()}`;
    const emailLinkedUserId = userInfo.email ? await redis.get(emailMapKey) : null;

    // Urutan penentuan id akun final:
    // 1. Sudah pernah login Google & sudah ke-link -> pakai id akun itu
    // 2. Ada record lama dengan id = Google id (akun google lama, belum pernah di-link) -> pakai id itu
    // 3. Email sudah terdaftar di akun lain (mis. daftar via email/password) -> LINK ke akun itu,
    //    supaya email yang sama bisa dipakai walau beda authType, tanpa bikin akun ganda
    // 4. Belum ada sama sekali -> user benar-benar baru, id = Google id
    const finalUserId = linkedUserId || (directUserData ? userInfo.id : null) || emailLinkedUserId || userInfo.id;

    const existingUserKey = `user:${finalUserId}`;
    const existingUserData = await redis.get(existingUserKey);
    let userData;

    if (existingUserData) {
        // User sudah ada (baik akun google lama maupun akun lain yang sedang di-link), update data jika perlu
        const existingUser = typeof existingUserData === 'string' 
            ? JSON.parse(existingUserData) 
            : existingUserData;

        // Kalau user pernah upload foto profil sendiri (hasCustomAvatar),
        // JANGAN timpa dengan foto Google — foto Google selalu ada/truthy,
        // jadi sebelumnya selalu menang dan menghapus foto custom tiap login ulang.
        const picture = existingUser.hasCustomAvatar
            ? existingUser.picture
            : (userInfo.picture || existingUser.picture);

        // Sama seperti foto: kalau user pernah ganti nama manual (hasCustomName),
        // JANGAN timpa dengan nama akun Google tiap login ulang.
        const name = existingUser.hasCustomName
            ? existingUser.name
            : (userInfo.name || existingUser.name);

        // Banner tidak pernah dikirim oleh Google, jadi otomatis tetap
        // ikut ke-spread dari existingUser di bawah — tidak perlu ditulis di sini.

        // Gabungkan daftar cara login yang pernah dipakai akun ini (email/google/dsb),
        // supaya email yang sama tetap bisa dipakai walau beda authType.
        const authProviders = Array.from(new Set([
            ...(existingUser.authProviders || (existingUser.authType ? [existingUser.authType] : [])),
            'google',
        ]));

        userData = {
            ...existingUser,
            id: finalUserId,
            name,
            email: userInfo.email || existingUser.email,
            picture,
            googleId: userInfo.id,
            authProviders,
            // authType menandai metode login TERAKHIR yang dipakai, bukan satu-satunya cara login
            authType: 'google',
            updatedAt: new Date().toISOString(),
        };
    } else {
        // User baru
        userData = {
            id: finalUserId,
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture,
            googleId: userInfo.id,
            authProviders: ['google'],
            authType: 'google', // TAMBAHKAN INI
            createdAt: new Date().toISOString(),
        };
    }

    // Simpan user data di bawah id akun final — supaya akun email/password yang sedang
    // di-link tidak malah terpecah jadi record baru yang terpisah
    await redis.set(`user:${finalUserId}`, JSON.stringify(userData));

    // Simpan/perbarui mapping email -> id akun final untuk login
    if (userInfo.email) {
        await redis.set(emailMapKey, finalUserId);
    }

    // Simpan mapping google id -> id akun final, supaya login Google berikutnya
    // selalu nyambung ke akun yang sama walau akun aslinya didaftarkan lewat email.
    await redis.set(googleLinkKey, finalUserId);
    await redis.sadd('users:all', finalUserId);

    // Generate JWT
    const token = jwt.sign(
        {
            userId: finalUserId,
            email: userInfo.email,
            authType: 'google', // Opsional: tambahkan ke JWT
        },
        getJwtSecret(),
        {
            expiresIn: '7d'
        }
    );

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    };

    res.setHeader(
        'Set-Cookie',
        cookie.serialize('token', token, cookieOptions)
    );

    // Redirect ke home dengan success
    res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/home`
    );

} catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_failed`
    );
}
    } else if (action === 'login') {
        // redis singleton used

res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
}

if (req.method !== 'POST') {
    return res.status(405).json({
        error: 'Method not allowed'
    });
}

try {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    const normalizedEmail = email.toLowerCase();
    let user = null;
    let userId = null;

    // METHOD 1: Cari via email mapping key (cara cepat)
    const emailKey = `user:email:${normalizedEmail}`;
    const foundUserId = await redis.get(emailKey);

    if (foundUserId) {
        // Dapatkan user data via userId
        const userData = await redis.get(`user:${foundUserId}`);
        if (userData) {
            user = typeof userData === 'string' ? JSON.parse(userData) : userData;
            userId = foundUserId;
        }
    }

    // METHOD 2: Jika tidak ditemukan via mapping, scan semua user keys
    if (!user) {
        console.log(`User not found via email mapping, scanning all keys...`);
        const allKeys = await redis.keys('user:*');

        // Filter hanya keys yang bukan email mapping
        const userKeys = allKeys.filter(key => !key.startsWith('user:email:'));

        for (const key of userKeys) {
            const userData = await redis.get(key);
            if (!userData) continue;

            const parsedUser = typeof userData === 'string' ? JSON.parse(userData) : userData;

            // Cek apakah email match
            if (parsedUser.email && parsedUser.email.toLowerCase() === normalizedEmail) {
                user = parsedUser;
                userId = parsedUser.id || key.replace('user:', '');
                console.log(`User found via scan: ${userId}`);
                break;
            }
        }
    }

    // Jika user masih tidak ditemukan
    if (!user) {
        return res.status(401).json({
            error: 'Invalid email or password'
        });
    }

    // Akun ini belum pernah set password (murni akun Google, belum pernah di-link
    // lewat form register/reset password) -> tidak bisa login pakai email/password
    if (!user.password) {
        return res.status(400).json({
            error: 'This email uses Google login. Please use Google to sign in, or set a password first via reset password.'
        });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return res.status(401).json({
            error: 'Invalid email or password'
        });
    }

    // Generate JWT
    const token = jwt.sign(
        { userId, email: normalizedEmail },
        getJwtSecret(),
        { expiresIn: '7d' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    };

    res.setHeader(
        'Set-Cookie',
        cookie.serialize('token', token, cookieOptions)
    );

    // Hapus password dari response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
        success: true,
        user: userWithoutPassword
    });

} catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
        error: 'Internal server error'
    });
}
    } else if (action === 'register') {
        // redis singleton used
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        try {
            const {
                name,
                email,
                password,
                verificationCode
            } = req.body;

            console.log('Register attempt:', {
                name,
                email,
                verificationCode
            }); // Debug log

            // Validation
            if (!name || !email || !password) {
                return res.status(400).json({
                    error: 'All fields are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    error: 'Password must be at least 6 characters'
                });
            }

            // Check if user exists
            const emailKey = `user:email:${email.toLowerCase()}`;
            const existingUserId = await redis.get(emailKey);
            let existingUser = null;
            if (existingUserId) {
                const existingUserData = await redis.get(`user:${existingUserId}`);
                existingUser = existingUserData
                    ? (typeof existingUserData === 'string' ? JSON.parse(existingUserData) : existingUserData)
                    : null;
            }

            // Email sudah punya password (sudah pernah daftar via email/password) -> tolak
            if (existingUser && existingUser.password) {
                return res.status(400).json({
                    error: 'Email already registered'
                });
            }

            // Verify code
            if (!verificationCode) {
                return res.status(400).json({
                    error: 'Verification code required'
                });
            }

            const storedCode = await redis.get(`verify:${email.toLowerCase()}`);
            console.log(`Stored code for ${email}:`, storedCode); // Debug log
            console.log(`Provided code:`, verificationCode); // Debug log

            // Compare codes (trim to handle any whitespace)
            if (!storedCode || storedCode.toString().trim() !== verificationCode.toString().trim()) {
                return res.status(400).json({
                    error: 'Invalid verification code'
                });
            }

            // Delete used verification code
            await redis.del(`verify:${email.toLowerCase()}`);

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            let user;
            let userId;

            if (existingUser) {
                // Email ini sudah punya akun (misalnya dari Google) tapi belum ada password ->
                // LINK: tambahkan login email/password ke akun yang sama, bukan bikin akun baru.
                // Supaya history, level, dan watchTime yang lama tetap kepakai.
                userId = existingUserId;
                const authProviders = Array.from(new Set([
                    ...(existingUser.authProviders || (existingUser.authType ? [existingUser.authType] : [])),
                    'email',
                ]));
                user = {
                    ...existingUser,
                    id: userId,
                    name: existingUser.hasCustomName ? existingUser.name : (name || existingUser.name),
                    password: hashedPassword,
                    authProviders,
                    authType: 'email',
                    updatedAt: new Date().toISOString(),
                };
            } else {
                // User benar-benar baru
                userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                user = {
                    id: userId,
                    name,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F6CF80&color=0a0a0c&size=128`,
                    createdAt: new Date().toISOString(),
                    authProviders: ['email'],
                    authType: 'email'
                };
            }

            // Save user to Redis
            await redis.set(`user:${userId}`, JSON.stringify(user));
            await redis.set(emailKey, userId);
        await redis.sadd('users:all', userId);

            // Generate JWT
            const token = jwt.sign({
                    userId,
                    email: email.toLowerCase()
                },
                getJwtSecret(), {
                    expiresIn: '7d'
                }
            );

            const isProd = process.env.NODE_ENV === 'production';
            const cookieOptions = {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
            };

            res.setHeader(
                'Set-Cookie',
                cookie.serialize('token', token, cookieOptions)
            );

            // Return user without password
            const {
                password: _,
                ...userWithoutPassword
            } = user;
            res.status(201).json({
                user: userWithoutPassword
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    } else if (action === 'request-verification') {
        // redis singleton used
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        try {
            const {
                email,
                type
            } = req.body;

            if (!email) {
                return res.status(400).json({
                    error: 'Email is required'
                });
            }

            // Check if email exists for reset password
            if (type === 'reset') {
                const userId = await redis.get(`user:email:${email.toLowerCase()}`);
                if (!userId) {
                    return res.status(404).json({
                        error: 'Email not registered'
                    });
                }
            }

            // Check if email already registered dengan password (akun email/password penuh) -> tolak.
            // Kalau email sudah ada tapi belum punya password (mis. akun Google saja),
            // tetap izinkan supaya user bisa "daftar" untuk link password ke akun itu.
            if (type === 'register') {
                const userId = await redis.get(`user:email:${email.toLowerCase()}`);
                if (userId) {
                    const existingUserData = await redis.get(`user:${userId}`);
                    const existingUser = existingUserData
                        ? (typeof existingUserData === 'string' ? JSON.parse(existingUserData) : existingUserData)
                        : null;
                    if (existingUser && existingUser.password) {
                        return res.status(400).json({
                            error: 'Email already registered'
                        });
                    }
                }
            }

            // Generate 6-digit verification code
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Store code in Redis with expiration (10 minutes for safety)
            const key = `verify:${email.toLowerCase()}`;
            await redis.set(key, code, {
                ex: 600
            }); // 10 minutes

            console.log(`Verification code for ${email}: ${code}`); // Debug log

            // Kirim email dengan kode — LANGSUNG via nodemailer, tanpa fetch ke API eksternal lagi
            const emailSubject = type === 'register' ?
                'Verifikasi Email - NdikzOne' :
                'Reset Password - NdikzOne';

            try {
                await sendVerificationEmail({
                    to: email,
                    subject: emailSubject,
                    code,
                    name: email.split('@')[0],
                });
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                throw new Error('Failed to send email');
            }

            res.json({
                success: true,
                message: 'Verification code sent to your email',
                email: email,
                // Hanya untuk debugging - hapus di production
                debugCode: process.env.NODE_ENV === 'development' ? code : undefined
            });
        } catch (error) {
            console.error('Request verification error:', error);
            res.status(500).json({
                error: 'Failed to send verification code'
            });
        }
    } else if (action === 'send-email') {
        // Endpoint mandiri buat kirim email verifikasi/reset, dipanggil dengan GET
        // seperti API gmailapi sebelumnya, tapi sekarang internal & pakai env vars.
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'GET') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        const { send, subject, code, name } = req.query;

        if (!send || !subject || !code) {
            return res.status(400).json({
                error: 'Missing required parameters: send, subject, code'
            });
        }

        try {
            await sendVerificationEmail({
                to: send,
                subject,
                code,
                name,
            });

            return res.status(200).json({
                status: true,
                message: 'Email sent successfully!',
                to: send,
                subject,
            });
        } catch (error) {
            console.error('Email error:', error);
            return res.status(500).json({
                status: false,
                message: 'Failed to send email.',
                error: error.message,
            });
        }
    } else if (action === 'reset-password') {
        // redis singleton used
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        try {
            const {
                email,
                verificationCode,
                newPassword
            } = req.body;

            console.log('Reset password attempt:', {
                email,
                verificationCode
            }); // Debug log

            if (!email || !verificationCode || !newPassword) {
                return res.status(400).json({
                    error: 'All fields are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    error: 'Password must be at least 6 characters'
                });
            }

            // Verify code - sama seperti di register
            const storedCode = await redis.get(`verify:${email.toLowerCase()}`);
            console.log(`Stored code for ${email}:`, storedCode); // Debug log
            console.log(`Provided code:`, verificationCode); // Debug log

            // Compare codes (trim to handle any whitespace)
            if (!storedCode || storedCode.toString().trim() !== verificationCode.toString().trim()) {
                return res.status(400).json({
                    error: 'Invalid or expired verification code'
                });
            }

            // Get user
            const userId = await redis.get(`user:email:${email.toLowerCase()}`);
            if (!userId) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            const userData = await redis.get(`user:${userId}`);
            if (!userData) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;

            // Update user in Redis
            await redis.set(`user:${userId}`, JSON.stringify(user));

            // Delete used verification code
            await redis.del(`verify:${email.toLowerCase()}`);

            console.log('✅ Password reset successful for:', email);

            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    } else if (action === 'verify-code') {
        // redis singleton used
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://ndichan.xyz');
        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({
                error: 'Method not allowed'
            });
        }

        try {
            const {
                email,
                code
            } = req.body;

            console.log('Verify code attempt:', {
                email,
                code
            }); // Debug log

            if (!email || !code) {
                return res.status(400).json({
                    error: 'Email and code are required'
                });
            }

            const storedCode = await redis.get(`verify:${email.toLowerCase()}`);
            console.log('Stored code:', storedCode); // Debug log

            if (!storedCode || storedCode.toString().trim() !== code.toString().trim()) {
                return res.status(400).json({
                    error: 'Invalid verification code'
                });
            }

            res.json({
                success: true,
                message: 'Code verified successfully'
            });
        } catch (error) {
            console.error('Verify code error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    } else {
        res.status(404).json({
            error: 'Endpoint not found'
        });
    }
}