'use strict';

const jwt = require('jsonwebtoken');
const { load } = require('../../../config');
const { ApiError } = require('./http');
const { randomToken, sha256 } = require('./text');
const db = require('../db');

const cfg = () => load().backend.jwt;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, name: user.display_name },
    cfg().secret,
    { expiresIn: cfg().expiresIn, issuer: 'pblog' }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, cfg().secret, { issuer: 'pblog' });
  } catch (e) {
    return null;
  }
}

/** 创建刷新令牌并入库 */
async function issueRefreshToken(userId, req) {
  const raw = randomToken(48);
  const hash = sha256(raw);
  const days = 30;
  const expiresAt = new Date(Date.now() + days * 864e5);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at) VALUES (?,?,?,?,?)',
    [userId, hash, String(req.headers['user-agent'] || '').slice(0, 250), clientIp(req), expiresAt]
  );
  return { token: raw, expiresAt };
}

async function rotateRefreshToken(raw, req) {
  const hash = sha256(raw);
  const row = await db.one(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1', [hash]
  );
  if (!row || new Date(row.expires_at) < new Date()) throw ApiError.unauthorized('会话已失效，请重新登录');
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);
  const next = await issueRefreshToken(row.user_id, req);
  const user = await db.one(
    'SELECT id, username, display_name, email, avatar, role FROM users WHERE id = ?', [row.user_id]
  );
  if (!user) throw ApiError.unauthorized('账号不存在');
  return { user, refresh: next };
}

/**
 * 只校验刷新令牌并返回用户，不轮换、不吊销。
 * 用于前台「识别当前登录身份」这类只读场景，
 * 避免把后台正在用的令牌消耗掉。
 */
async function peekRefreshToken(raw) {
  const hash = sha256(raw);
  const row = await db.one(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1', [hash]
  );
  if (!row || new Date(row.expires_at) < new Date()) return null;
  const user = await db.one(
    'SELECT id, username, display_name, email, avatar, bio, role, status, email_verified_at FROM users WHERE id = ?',
    [row.user_id]
  );
  if (!user || user.status === 'banned') return null;
  return user;
}

async function revokeRefreshToken(raw) {
  if (!raw) return;
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [sha256(raw)]);
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

/** 必须登录 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized());
  const payload = verifyAccessToken(token);
  if (!payload) return next(ApiError.unauthorized());
  req.user = { id: payload.sub, username: payload.username, role: payload.role, displayName: payload.name };
  next();
}

/** 必须管理员 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(ApiError.forbidden('需要管理员权限'));
    next();
  });
}

/** 可选登录（评论时识别管理员；也支持 ?t= 传 token 供 SSE 使用） */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  // EventSource 无法自定义 Header，因此允许查询参数传令牌
  if (!token && req.query && req.query.t) token = String(req.query.t);
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = { id: payload.sub, username: payload.username, role: payload.role, displayName: payload.name };
    }
  }
  next();
}

module.exports = {
  signAccessToken, verifyAccessToken, issueRefreshToken, rotateRefreshToken, peekRefreshToken,
  revokeRefreshToken, requireAuth, requireAdmin, optionalAuth, clientIp,
};
