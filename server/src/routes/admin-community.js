'use strict';

/**
 * 管理端：成员账号、聊天室、留言墙、邮件设置、音乐设置
 * 前缀 /api/admin
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { wrap, ok, ApiError, parsePaging, pagingMeta } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const mailer = require('../lib/mailer');

const router = express.Router();
router.use(requireAdmin);

/* ================= 成员账号 ================= */
router.get('/members', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 20);
  const q = req.query.q;
  const where = ["role = 'member'"];
  const params = [];
  if (q) { where.push('(username LIKE ? OR display_name LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const total = await db.scalar(`SELECT COUNT(*) FROM users ${whereSql}`, params);
  const rows = await db.all(
    `SELECT id, username, display_name, email, avatar, status, email_verified_at, last_login_at, created_at
       FROM users ${whereSql} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

router.patch('/members/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['active', 'banned'].includes(status)) throw ApiError.badRequest('状态不合法');
  await db.query("UPDATE users SET status = ? WHERE id = ? AND role = 'member'", [status, id]);
  if (status === 'banned') {
    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [id]);
  }
  ok(res, { updated: true });
}));

router.delete('/members/:id', wrap(async (req, res) => {
  await db.query("DELETE FROM users WHERE id = ? AND role = 'member'", [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/* ================= 聊天室管理 ================= */
router.get('/chat', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 30);
  const room = req.query.room;
  const where = [];
  const params = [];
  if (room === 'public' || room === 'members') { where.push('room = ?'); params.push(room); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = await db.scalar(`SELECT COUNT(*) FROM chat_messages ${whereSql}`, params);
  const rows = await db.all(
    `SELECT * FROM chat_messages ${whereSql} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

router.patch('/chat/:id', wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['visible', 'hidden'].includes(status)) throw ApiError.badRequest('状态不合法');
  await db.query('UPDATE chat_messages SET status = ? WHERE id = ?', [status, Number(req.params.id)]);
  ok(res, { updated: true });
}));

router.delete('/chat/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM chat_messages WHERE id = ?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/* ================= 留言墙管理 ================= */
router.get('/guestbook', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 30);
  const total = await db.scalar('SELECT COUNT(*) FROM guestbook');
  const rows = await db.all(
    `SELECT * FROM guestbook ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

router.patch('/guestbook/:id', wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'approved', 'hidden'].includes(status)) throw ApiError.badRequest('状态不合法');
  await db.query('UPDATE guestbook SET status = ? WHERE id = ?', [status, Number(req.params.id)]);
  ok(res, { updated: true });
}));

router.post('/guestbook/:id/reply', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parent = await db.one('SELECT id FROM guestbook WHERE id = ?', [id]);
  if (!parent) throw ApiError.notFound('留言不存在');
  const content = String(req.body?.content || '').trim();
  if (!content) throw ApiError.badRequest('回复内容不能为空');
  const me = await db.one('SELECT display_name, username, avatar FROM users WHERE id = ?', [req.user.id]);
  const r = await db.query(
    `INSERT INTO guestbook (parent_id, user_id, nickname, avatar, content, status, is_admin)
     VALUES (?,?,?,?,?,'approved',1)`,
    [id, req.user.id, me.display_name || me.username, me.avatar, content.slice(0, 1000)]
  );
  ok(res, { id: r.insertId });
}));

router.delete('/guestbook/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM guestbook WHERE id = ?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/* ================= 邮件设置 ================= */
router.get('/mail-config', wrap(async (req, res) => {
  const cfg = await mailer.getMailConfig();
  ok(res, { ...cfg, pass: cfg.pass ? '********' : '' });
}));

router.put('/mail-config', wrap(async (req, res) => {
  const b = req.body || {};
  const current = await mailer.getMailConfig();
  const next = {
    enabled: b.enabled !== undefined ? !!b.enabled : current.enabled,
    host: b.host !== undefined ? String(b.host).trim() : current.host,
    port: b.port !== undefined ? Number(b.port) || 465 : current.port,
    secure: b.secure !== undefined ? !!b.secure : current.secure,
    user: b.user !== undefined ? String(b.user).trim() : current.user,
    // 传入 ******** 表示不修改密码
    pass: b.pass && b.pass !== '********' ? String(b.pass) : current.pass,
    fromName: b.fromName !== undefined ? String(b.fromName) : current.fromName,
    fromEmail: b.fromEmail !== undefined ? String(b.fromEmail).trim() : current.fromEmail,
    requireVerify: b.requireVerify !== undefined ? !!b.requireVerify : current.requireVerify,
  };
  await db.query(
    `INSERT INTO settings (key_name, value_json) VALUES ('mail', ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [JSON.stringify(next)]
  );
  mailer.resetTransport();
  ok(res, { updated: true });
}));

router.post('/mail-config/test', wrap(async (req, res) => {
  const result = await mailer.verifyConnection();
  ok(res, result);
}));

router.post('/mail-config/send-test', wrap(async (req, res) => {
  const to = String(req.body?.to || '').trim();
  if (!to) throw ApiError.badRequest('请填写收件邮箱');
  const r = await mailer.sendMail({
    to,
    subject: 'PBLOG 测试邮件',
    html: '<p>如果你收到了这封邮件，说明 SMTP 配置正确。</p>',
    text: 'SMTP 配置正确。',
  });
  ok(res, r);
}));

/* ================= 音乐设置 ================= */
const DEFAULT_MUSIC = {
  enabled: false,
  provider: 'netease',
  // 网易云歌单/歌曲 ID（从分享链接里提取）
  playlistId: '',
  songId: '',
  // 外链播放器主题色（网易 iframe 支持 0-16 或十六进制）
  theme: '#6ee7b7',
  autoPlay: false,
  // 是否只在首页显示
  homeOnly: false,
  // 抽屉默认是否展开
  defaultOpen: false,
};

router.get('/music-config', wrap(async (req, res) => {
  const row = await db.one("SELECT value_json FROM settings WHERE key_name='music' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  ok(res, { ...DEFAULT_MUSIC, ...stored });
}));

router.put('/music-config', wrap(async (req, res) => {
  const b = req.body || {};
  const row = await db.one("SELECT value_json FROM settings WHERE key_name='music' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  const next = { ...DEFAULT_MUSIC, ...stored, ...b };
  await db.query(
    `INSERT INTO settings (key_name, value_json) VALUES ('music', ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [JSON.stringify(next)]
  );
  ok(res, { updated: true });
}));

/* ================= 留言墙外观（弹幕风格） ================= */
const DEFAULT_GUESTBOOK_STYLE = {
  // 弹幕速度：像素/秒
  speed: 70,
  // 字号范围（px）
  minFontSize: 14,
  maxFontSize: 26,
  // 随机配色池（仅使用这些颜色，避免刺眼）
  colors: ['#e8edf2', '#6ee7b7', '#818cf8', '#fbbf24', '#fb7185', '#67e8f9', '#cbd5e1'],
  // 弹幕轨道数量（纵向分几条道，避免重叠）
  lanes: 8,
  // 同屏最大弹幕数
  maxOnScreen: 18,
  // 悬停/点击后停留秒数
  pauseSeconds: 5,
  // 是否显示心情标签
  showMood: true,
};

router.get('/guestbook-style', wrap(async (req, res) => {
  const row = await db.one("SELECT value_json FROM settings WHERE key_name='guestbook_style' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  ok(res, { ...DEFAULT_GUESTBOOK_STYLE, ...stored });
}));

router.put('/guestbook-style', wrap(async (req, res) => {
  const b = req.body || {};
  const row = await db.one("SELECT value_json FROM settings WHERE key_name='guestbook_style' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  const cur = { ...DEFAULT_GUESTBOOK_STYLE, ...stored };

  const clamp = (n, lo, hi, dflt) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return dflt;
    return Math.min(hi, Math.max(lo, v));
  };

  let colors = Array.isArray(b.colors) ? b.colors : cur.colors;
  colors = colors
    .filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
    .slice(0, 16);
  if (!colors.length) colors = DEFAULT_GUESTBOOK_STYLE.colors;

  const minFontSize = clamp(b.minFontSize ?? cur.minFontSize, 11, 28, 14);
  const maxFontSize = Math.max(minFontSize, clamp(b.maxFontSize ?? cur.maxFontSize, 13, 40, 26));

  const next = {
    speed: clamp(b.speed ?? cur.speed, 20, 260, 70),
    minFontSize,
    maxFontSize,
    colors,
    lanes: clamp(b.lanes ?? cur.lanes, 3, 16, 8),
    maxOnScreen: clamp(b.maxOnScreen ?? cur.maxOnScreen, 4, 60, 18),
    pauseSeconds: clamp(b.pauseSeconds ?? cur.pauseSeconds, 1, 30, 5),
    showMood: b.showMood !== undefined ? !!b.showMood : !!cur.showMood,
  };

  await db.query(
    `INSERT INTO settings (key_name, value_json) VALUES ('guestbook_style', ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [JSON.stringify(next)]
  );
  ok(res, next);
}));

module.exports = router;
