'use strict';

/**
 * 认证 API
 * POST /api/auth/login     登录（返回 accessToken + refreshToken）
 * POST /api/auth/refresh   用刷新令牌换新的 accessToken
 * POST /api/auth/logout    注销当前会话
 * GET  /api/auth/me        当前用户
 * PUT  /api/auth/profile   修改资料
 * PUT  /api/auth/password  修改密码
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { wrap, ok, ApiError } = require('../lib/http');
const auth = require('../lib/auth');

const router = express.Router();

const LOGIN_FAIL_DELAY = 400;

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw ApiError.badRequest('请输入用户名和密码');

  const user = await db.one('SELECT * FROM users WHERE username = ? LIMIT 1', [String(username).trim()]);
  if (!user) {
    await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY));
    throw ApiError.unauthorized('用户名或密码不正确');
  }
  const match = await bcrypt.compare(String(password), user.password_hash);
  if (!match) {
    await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY));
    throw ApiError.unauthorized('用户名或密码不正确');
  }

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  const accessToken = auth.signAccessToken(user);
  const refresh = await auth.issueRefreshToken(user.id, req);

  await db.query(
    'INSERT INTO audit_logs (user_id, action, target, ip) VALUES (?,?,?,?)',
    [user.id, 'login', 'auth', auth.clientIp(req)]
  );

  ok(res, {
    accessToken,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: {
      id: user.id, username: user.username, displayName: user.display_name,
      email: user.email, avatar: user.avatar, bio: user.bio, role: user.role,
    },
  });
}));

router.post('/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw ApiError.badRequest('缺少 refreshToken');
  const { user, refresh } = await auth.rotateRefreshToken(String(refreshToken), req);
  const accessToken = auth.signAccessToken(user);
  ok(res, {
    accessToken,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: {
      id: user.id, username: user.username, displayName: user.display_name,
      email: user.email, avatar: user.avatar, role: user.role,
    },
  });
}));

router.post('/logout', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};
  await auth.revokeRefreshToken(refreshToken);
  ok(res, { loggedOut: true });
}));

router.get('/me', auth.requireAuth, wrap(async (req, res) => {
  const user = await db.one(
    'SELECT id, username, display_name, email, avatar, bio, role, last_login_at, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) throw ApiError.unauthorized();
  ok(res, user);
}));

router.put('/profile', auth.requireAuth, wrap(async (req, res) => {
  const { displayName, email, avatar, bio } = req.body || {};
  await db.query(
    'UPDATE users SET display_name = COALESCE(?, display_name), email = COALESCE(?, email), avatar = COALESCE(?, avatar), bio = COALESCE(?, bio) WHERE id = ?',
    [
      displayName != null ? String(displayName).slice(0, 64) : null,
      email != null ? String(email).slice(0, 190) : null,
      avatar != null ? String(avatar).slice(0, 500) : null,
      bio != null ? String(bio).slice(0, 1000) : null,
      req.user.id,
    ]
  );
  ok(res, { updated: true });
}));

router.put('/password', auth.requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) throw ApiError.badRequest('新密码至少 8 位');
  const user = await db.one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const match = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!match) throw ApiError.badRequest('当前密码不正确');
  const hash = await bcrypt.hash(String(newPassword), 10);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  // 让所有旧会话失效
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [req.user.id]);
  await db.query('INSERT INTO audit_logs (user_id, action, target, ip) VALUES (?,?,?,?)',
    [req.user.id, 'change_password', 'auth', auth.clientIp(req)]);
  ok(res, { updated: true });
}));

module.exports = router;
