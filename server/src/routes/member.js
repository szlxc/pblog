'use strict';

/**
 * 访客账号 API（普通用户）
 * POST /api/member/register   注册（用户名+密码，邮箱选填）
 * POST /api/member/login      登录
 * POST /api/member/verify     邮箱验证（token）
 * POST /api/member/resend     重发验证邮件
 * POST /api/member/forgot     申请找回密码
 * POST /api/member/reset      重置密码
 * GET  /api/member/me         当前访客信息
 * PUT  /api/member/profile    修改资料
 * PUT  /api/member/password   修改密码
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../db');
const { wrap, ok, created, ApiError } = require('../lib/http');
const auth = require('../lib/auth');
const { randomToken, sha256 } = require('../lib/text');
const mailer = require('../lib/mailer');
const { load } = require('../../../config');

const router = express.Router();

/* ---------- 上传配置（图片 + 短视频） ---------- */
const UPLOAD_DIR = path.resolve(load().backend.upload.dir);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MEDIA = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];

const memberUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8)
        || (file.mimetype.startsWith('video/') ? '.mp4' : '.bin');
      cb(null, `u${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MEDIA.includes(file.mimetype)) {
      return cb(ApiError.badRequest(`不支持的文件类型：${file.mimetype}`));
    }
    cb(null, true);
  },
});
const uploadSingle = memberUpload.single('file');

const MEMBER_FIELDS = 'id, username, display_name, email, avatar, bio, role, email_verified_at, preferences, created_at';

/* ---------------- 注册 ---------------- */
router.post('/register', wrap(async (req, res) => {
  const { allowRegistration } = load().features;
  const settings = await db.one("SELECT value_json FROM settings WHERE key_name='features' LIMIT 1").catch(() => null);
  const stored = settings ? (typeof settings.value_json === 'string' ? JSON.parse(settings.value_json) : settings.value_json) : {};
  const enabled = stored.allowRegistration !== undefined ? !!stored.allowRegistration : !!allowRegistration;
  if (!enabled) throw ApiError.forbidden('站点暂未开放注册');

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const email = String(req.body?.email || '').trim();
  const displayName = String(req.body?.displayName || '').trim() || username;

  if (!/^[\w\u4e00-\u9fa5-]{2,20}$/.test(username)) {
    throw ApiError.badRequest('用户名 2-20 位，仅字母、数字、下划线、连字符或中文');
  }
  if (password.length < 8) throw ApiError.badRequest('密码至少 8 位');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('邮箱格式不正确');

  const exists = await db.one('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (exists) throw ApiError.conflict('该用户名已被占用');
  if (email) {
    const emailUsed = await db.one('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (emailUsed) throw ApiError.conflict('该邮箱已被使用');
  }

  const mailCfg = await mailer.getMailConfig();
  const needVerify = !!(mailCfg.enabled && mailCfg.requireVerify && email);
  const hash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO users (username, password_hash, email, display_name, role, email_verified_at)
     VALUES (?,?,?,?,'member',?)`,
    [username, hash, email || null, displayName.slice(0, 64), needVerify ? null : null]
  );

  let verifySent = false;
  if (needVerify) {
    const token = randomToken(24);
    await db.query(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, 'verify', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [result.insertId, sha256(token)]
    );
    const base = String(load().backend.publicUrl).replace(/\/$/, '');
    const link = `${base}/verify?token=${token}`;
    const r = await mailer.sendMail({
      to: email,
      subject: `【${load().sites.frontend.title}】请验证你的邮箱`,
      html: `<p>你好 ${displayName}，</p><p>点击下面的链接完成邮箱验证（24 小时内有效）：</p>
             <p><a href="${link}">${link}</a></p><p>如果不是你本人操作，请忽略此邮件。</p>`,
      text: `验证链接（24 小时内有效）：${link}`,
    });
    verifySent = r.sent;
  }

  ok(res, {
    id: result.insertId,
    needVerify,
    verifySent,
    message: needVerify
      ? (verifySent ? '注册成功，请查收验证邮件' : '注册成功，但邮件发送失败，请联系管理员')
      : '注册成功，可以直接登录',
  });
}));

/* ---------------- 登录 ---------------- */
router.post('/login', wrap(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) throw ApiError.badRequest('请输入用户名和密码');

  const user = await db.one('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  if (!user) {
    await new Promise((r) => setTimeout(r, 300));
    throw ApiError.unauthorized('用户名或密码不正确');
  }
  if (user.status === 'banned') throw ApiError.forbidden('该账号已被封禁');
  if (user.role !== 'member') throw ApiError.badRequest('管理员请从管理端登录');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await new Promise((r) => setTimeout(r, 300));
    throw ApiError.unauthorized('用户名或密码不正确');
  }

  const mailCfg = await mailer.getMailConfig();
  if (mailCfg.enabled && mailCfg.requireVerify && user.email && !user.email_verified_at) {
    throw ApiError.forbidden('邮箱尚未验证，请先查收验证邮件');
  }

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  const accessToken = auth.signAccessToken(user);
  const refresh = await auth.issueRefreshToken(user.id, req);

  const fresh = await db.one(`SELECT ${MEMBER_FIELDS} FROM users WHERE id = ?`, [user.id]);
  ok(res, {
    accessToken,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: fresh,
  });
}));

/* ---------------- 刷新令牌 ----------------
 * 同时接受会员与管理员令牌：
 * 管理员在后台登录后，前台用它恢复会话，从而实现「一处登录，两处可见」。
 */
router.post('/refresh', wrap(async (req, res) => {
  const rt = String(req.body?.refreshToken || '');
  if (!rt) throw ApiError.badRequest('缺少 refreshToken');

  // 先只读校验，判断这是谁的令牌
  const peek = await auth.peekRefreshToken(rt);
  if (!peek) throw ApiError.unauthorized('会话已失效，请重新登录');
  if (peek.status === 'banned') throw ApiError.forbidden('账号已被封禁');

  // 管理员令牌：只返回身份，不轮换，避免把后台会话消耗掉
  if (peek.role === 'admin' || peek.role === 'editor') {
    return ok(res, {
      accessToken: auth.signAccessToken(peek),
      // 不返回新的 refreshToken，前台不会覆盖管理端的那一份
      refreshToken: null,
      user: peek,
      scope: 'admin',
    });
  }

  // 普通成员令牌：正常轮换
  const { user, refresh } = await auth.rotateRefreshToken(rt, req);
  const fresh = await db.one(`SELECT ${MEMBER_FIELDS} FROM users WHERE id = ?`, [user.id]);
  ok(res, {
    accessToken: auth.signAccessToken(user),
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: fresh,
    scope: 'member',
  });
}));

/* ---------------- 上传（登录用户，供聊天室使用） ---------------- */
router.post('/upload', auth.requireAuth, uploadSingle, wrap(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('没有收到文件');
  const publicUrl = String(load().backend.publicUrl).replace(/\/$/, '');
  const url = `${publicUrl}/uploads/${req.file.filename}`;
  created(res, {
    url,
    filename: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
    mediaType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
  });
}));

/* ---------------- 邮箱验证 ---------------- */
router.post('/verify', wrap(async (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) throw ApiError.badRequest('缺少验证令牌');
  const row = await db.one(
    `SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'verify' AND used_at IS NULL LIMIT 1`,
    [sha256(token)]
  );
  if (!row) throw ApiError.badRequest('验证链接无效或已使用');
  if (new Date(row.expires_at) < new Date()) throw ApiError.badRequest('验证链接已过期，请重新发送');
  await db.query('UPDATE email_tokens SET used_at = NOW() WHERE id = ?', [row.id]);
  await db.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [row.user_id]);
  ok(res, { verified: true });
}));

/* ---------------- 重发验证邮件 ---------------- */
router.post('/resend', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) throw ApiError.badRequest('请填写邮箱');
  const user = await db.one('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  // 不论是否存在都返回成功，避免探测邮箱
  if (!user || user.email_verified_at) return ok(res, { sent: true });

  const token = randomToken(24);
  await db.query(
    `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
     VALUES (?, 'verify', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [user.id, sha256(token)]
  );
  const base = String(load().backend.publicUrl).replace(/\/$/, '');
  const link = `${base}/verify?token=${token}`;
  await mailer.sendMail({
    to: email,
    subject: `【${load().sites.frontend.title}】邮箱验证`,
    html: `<p>点击链接完成验证（24 小时有效）：</p><p><a href="${link}">${link}</a></p>`,
    text: `验证链接：${link}`,
  });
  ok(res, { sent: true });
}));

/* ---------------- 找回密码 ---------------- */
router.post('/forgot', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) throw ApiError.badRequest('请填写邮箱');
  const user = await db.one('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (user) {
    const token = randomToken(24);
    await db.query(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, 'reset', ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [user.id, sha256(token)]
    );
    const base = String(load().backend.publicUrl).replace(/\/$/, '');
    const link = `${base}/reset?token=${token}`;
    await mailer.sendMail({
      to: email,
      subject: `【${load().sites.frontend.title}】重置密码`,
      html: `<p>点击链接重置密码（1 小时内有效）：</p><p><a href="${link}">${link}</a></p>`,
      text: `重置链接：${link}`,
    });
  }
  ok(res, { sent: true, message: '如果该邮箱已注册，重置邮件将很快送达' });
}));

router.post('/reset', wrap(async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (password.length < 8) throw ApiError.badRequest('密码至少 8 位');
  const row = await db.one(
    `SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL LIMIT 1`,
    [sha256(token)]
  );
  if (!row) throw ApiError.badRequest('重置链接无效或已使用');
  if (new Date(row.expires_at) < new Date()) throw ApiError.badRequest('重置链接已过期');
  const hash = await bcrypt.hash(password, 10);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
  await db.query('UPDATE email_tokens SET used_at = NOW() WHERE id = ?', [row.id]);
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [row.user_id]);
  ok(res, { reset: true });
}));

/* ---------------- 当前用户 ---------------- */
router.get('/me', auth.requireAuth, wrap(async (req, res) => {
  const user = await db.one(`SELECT ${MEMBER_FIELDS} FROM users WHERE id = ?`, [req.user.id]);
  if (!user) throw ApiError.unauthorized();
  ok(res, user);
}));

/* ---------------- 个人中心：汇总信息 ---------------- */
router.get('/dashboard', auth.requireAuth, wrap(async (req, res) => {
  const uid = req.user.id;
  const user = await db.one(`SELECT ${MEMBER_FIELDS} FROM users WHERE id = ?`, [uid]);
  if (!user) throw ApiError.unauthorized();

  const [chatCount, gbCount, commentCount, recentChat, recentGb] = await Promise.all([
    db.scalar('SELECT COUNT(*) FROM chat_messages WHERE user_id = ? AND status = \'visible\'', [uid]),
    db.scalar('SELECT COUNT(*) FROM guestbook WHERE user_id = ? AND status = \'approved\'', [uid]),
    db.scalar('SELECT COUNT(*) FROM comments WHERE author_email = ? AND status = \'approved\'', [user.email || '']),
    db.all(
      `SELECT id, room, content, media_type, created_at FROM chat_messages
        WHERE user_id = ? ORDER BY id DESC LIMIT 5`, [uid]
    ),
    db.all(
      `SELECT id, content, created_at FROM guestbook
        WHERE user_id = ? ORDER BY id DESC LIMIT 5`, [uid]
    ),
  ]);

  ok(res, {
    user,
    stats: { chatCount: chatCount || 0, guestbookCount: gbCount || 0, commentCount: commentCount || 0 },
    recentChat: recentChat || [],
    recentGuestbook: recentGb || [],
  });
}));

/* ---------------- 个人主题偏好 ----------------
 * 每个登录用户（含管理员）各自保存一份，前台「外观设置」改动后自动同步到这里，
 * 下次登录自动应用。
 */
const ALLOWED_PREF_THEME_KEYS = [
  'mode', 'accent', 'accentName', 'fontSize', 'radius', 'readingWidth',
];

router.get('/preferences', auth.requireAuth, wrap(async (req, res) => {
  const row = await db.one('SELECT preferences FROM users WHERE id = ?', [req.user.id]);
  let prefs = {};
  if (row?.preferences) {
    prefs = typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences;
  }
  ok(res, prefs || {});
}));

router.put('/preferences', auth.requireAuth, wrap(async (req, res) => {
  const body = req.body || {};
  const row = await db.one('SELECT preferences FROM users WHERE id = ?', [req.user.id]);
  let cur = {};
  if (row?.preferences) {
    cur = typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences;
  }
  // 只接受白名单字段，其余透传会带来注入风险
  const nextTheme = {};
  for (const k of ALLOWED_PREF_THEME_KEYS) {
    if (body.theme && body.theme[k] !== undefined) nextTheme[k] = body.theme[k];
  }
  const next = { ...cur, theme: { ...(cur.theme || {}), ...nextTheme } };
  await db.query('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify(next), req.user.id]);
  ok(res, next);
}));

router.put('/profile', auth.requireAuth, wrap(async (req, res) => {
  const { displayName, avatar, bio } = req.body || {};
  await db.query(
    'UPDATE users SET display_name = COALESCE(?, display_name), avatar = COALESCE(?, avatar), bio = COALESCE(?, bio) WHERE id = ?',
    [
      displayName != null ? String(displayName).slice(0, 64) : null,
      avatar != null ? String(avatar).slice(0, 500) : null,
      bio != null ? String(bio).slice(0, 500) : null,
      req.user.id,
    ]
  );
  ok(res, { updated: true });
}));

router.put('/password', auth.requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) throw ApiError.badRequest('新密码至少 8 位');
  const user = await db.one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user) throw ApiError.unauthorized();
  const match = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!match) throw ApiError.badRequest('当前密码不正确');
  const hash = await bcrypt.hash(String(newPassword), 10);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  ok(res, { updated: true });
}));

module.exports = router;
