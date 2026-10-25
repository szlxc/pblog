'use strict';

/**
 * 留言墙
 * GET  /api/guestbook           读取留言（树形）
 * POST /api/guestbook           发表留言（可匿名）
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, ApiError } = require('../lib/http');
const { optionalAuth, clientIp } = require('../lib/auth');
const { sha256 } = require('../lib/text');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT id, parent_id, nickname, avatar, content, mood, is_admin, user_id, created_at
       FROM guestbook WHERE status = 'approved'
      ORDER BY created_at ASC LIMIT 500`
  );
  const byId = new Map();
  const roots = [];
  for (const r of rows) byId.set(r.id, { ...r, replies: [] });
  for (const r of byId.values()) {
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).replies.push(r);
    else roots.push(r);
  }
  roots.reverse();
  ok(res, roots);
}));

router.post('/', optionalAuth, wrap(async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (content.length < 1) throw ApiError.badRequest('留言不能为空');
  if (content.length > 1000) throw ApiError.badRequest('留言过长（最多 1000 字）');

  let nickname = String(req.body?.nickname || '').trim().slice(0, 64);
  let avatar = null;
  let isAdmin = 0;
  let userId = null;

  if (req.user) {
    const u = await db.one('SELECT id, display_name, username, avatar, role FROM users WHERE id = ?', [req.user.id]);
    if (u) {
      userId = u.id;
      nickname = nickname || u.display_name || u.username;
      avatar = u.avatar || null;
      isAdmin = u.role === 'admin' || u.role === 'editor' ? 1 : 0;
    }
  }
  if (!nickname) nickname = `访客${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
  if (parentId) {
    const parent = await db.one("SELECT id FROM guestbook WHERE id = ? AND status = 'approved'", [parentId]);
    if (!parent) throw ApiError.badRequest('回复的留言不存在');
  }

  const mood = ['happy', 'love', 'think', 'cool', 'sad'].includes(req.body?.mood)
    ? req.body.mood : null;

  const result = await db.query(
    `INSERT INTO guestbook (parent_id, user_id, nickname, email, avatar, content, mood, status, is_admin, ip_hash)
     VALUES (?,?,?,?,?,?,?,'approved',?,?)`,
    [
      parentId, userId, nickname,
      req.body?.email ? String(req.body.email).slice(0, 190) : null,
      avatar, content.slice(0, 1000), mood, isAdmin,
      sha256(clientIp(req)).slice(0, 64),
    ]
  );
  ok(res, { id: result.insertId });
}));

module.exports = router;
