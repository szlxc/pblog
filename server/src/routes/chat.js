'use strict';

/**
 * 聊天室
 * GET  /api/chat/history?room=public|members&before=id   拉历史消息
 * GET  /api/chat/stream?room=...                         SSE 实时推送
 * POST /api/chat/send                                    发消息（公共房任何人；登录房需登录）
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, ApiError } = require('../lib/http');
const { requireAuth, optionalAuth, clientIp } = require('../lib/auth');
const { sha256 } = require('../lib/text');
const { load } = require('../../../config');

const router = express.Router();

/* ---------------- SSE 订阅者管理 ---------------- */
const subscribers = new Map(); // room -> Set<res>

function broadcast(room, payload) {
  const set = subscribers.get(room);
  if (!set) return;
  const data = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch (_) { set.delete(res); }
  }
}

// 心跳，防止代理层断开
setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) {
      try { res.write(': ping\n\n'); } catch (_) { set.delete(res); }
    }
  }
}, 25000).unref?.();

/* ---------------- 功能开关 ---------------- */
async function chatEnabled() {
  const row = await db.one("SELECT value_json FROM settings WHERE key_name='plugins' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  const base = load().sites.plugins || {};
  return (stored.chat !== undefined ? !!stored.chat : base.chat !== false);
}

/* ---------------- 历史消息 ---------------- */
router.get('/history', wrap(async (req, res) => {
  if (!(await chatEnabled())) throw ApiError.notFound('聊天室未开启');
  const room = req.query.room === 'members' ? 'members' : 'public';
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const before = Number(req.query.before) || 0;

  const where = ["room = ?", "status = 'visible'"];
  const params = [room];
  if (before > 0) { where.push('id < ?'); params.push(before); }

  const rows = await db.all(
    `SELECT id, room, user_id, nickname, avatar, content, media_url, media_type, created_at
       FROM chat_messages WHERE ${where.join(' AND ')}
      ORDER BY id DESC LIMIT ${limit}`,
    params
  );
  ok(res, rows.reverse());
}));

/* ---------------- SSE 实时流 ---------------- */
router.get('/stream', optionalAuth, wrap(async (req, res) => {
  if (!(await chatEnabled())) throw ApiError.notFound('聊天室未开启');
  const room = req.query.room === 'members' ? 'members' : 'public';
  if (room === 'members' && !req.user) throw ApiError.unauthorized('登录后才能进入此房间');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ room })}\n\n`);

  if (!subscribers.has(room)) subscribers.set(room, new Set());
  subscribers.get(room).add(res);

  req.on('close', () => {
    const set = subscribers.get(room);
    if (set) set.delete(res);
  });
}));

/* ---------------- 发送消息 ---------------- */
router.post('/send', optionalAuth, wrap(async (req, res) => {
  if (!(await chatEnabled())) throw ApiError.forbidden('聊天室未开启');
  const room = req.body?.room === 'members' ? 'members' : 'public';
  const content = String(req.body?.content || '').trim();
  let mediaUrl = req.body?.mediaUrl ? String(req.body.mediaUrl) : null;
  let mediaType = ['image', 'video'].includes(req.body?.mediaType) ? req.body.mediaType : null;

  if (room === 'members' && !req.user) throw ApiError.unauthorized('请先登录再进入此房间');
  if (!content && !mediaUrl) throw ApiError.badRequest('消息不能为空');
  if (content.length > 1000) throw ApiError.badRequest('消息过长（最多 1000 字）');

  // 公共房间不允许发媒体
  if (room === 'public' && mediaUrl) {
    mediaUrl = null;
    mediaType = null;
  }

  let nickname = String(req.body?.nickname || '').trim().slice(0, 64) || '访客';
  let avatar = null;
  let userId = null;

  if (req.user) {
    const u = await db.one('SELECT id, display_name, username, avatar, role FROM users WHERE id = ?', [req.user.id]);
    if (u) {
      userId = u.id;
      nickname = u.display_name || u.username;
      avatar = u.avatar || null;
    }
  } else if (room === 'members') {
    throw ApiError.unauthorized('请先登录');
  }

  if (!nickname || nickname === '访客') {
    nickname = `访客${String(Math.floor(Math.random() * 9000) + 1000)}`;
  }

  const ip = clientIp(req);
  const result = await db.query(
    `INSERT INTO chat_messages (room, user_id, nickname, avatar, content, media_url, media_type, ip_hash)
     VALUES (?,?,?,?,?,?,?,?)`,
    [room, userId, nickname, avatar, content || null, mediaUrl, mediaType, sha256(ip).slice(0, 64)]
  );

  const msg = {
    id: result.insertId,
    room,
    user_id: userId,
    nickname,
    avatar,
    content: content || null,
    media_url: mediaUrl,
    media_type: mediaType,
    created_at: new Date().toISOString(),
  };
  broadcast(room, msg);
  ok(res, msg);
}));

/* ---------------- 在线人数（简单统计） ---------------- */
router.get('/online', wrap(async (req, res) => {
  const room = req.query.room === 'members' ? 'members' : 'public';
  const set = subscribers.get(room);
  ok(res, { room, online: set ? set.size : 0 });
}));

module.exports = router;
