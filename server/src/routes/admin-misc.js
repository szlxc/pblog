'use strict';

/**
 * 管理端：独立页面、友链、媒体库、设置、审计日志
 * 前缀 /api/admin
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { wrap, ok, created, ApiError, parsePaging, pagingMeta } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { makeSlug } = require('../lib/text');
const { load } = require('../../../config');
// 注意：此文件不处理文章，仅页面/友链/媒体/设置/审计

const router = express.Router();
router.use(requireAdmin);

/* ================= 独立页面 ================= */
router.get('/pages', wrap(async (req, res) => {
  ok(res, await db.all('SELECT id,title,slug,status,show_in_nav,sort_order,updated_at FROM pages ORDER BY sort_order, id'));
}));

router.get('/pages/:id', wrap(async (req, res) => {
  const p = await db.one('SELECT * FROM pages WHERE id=?', [Number(req.params.id)]);
  if (!p) throw ApiError.notFound('页面不存在');
  ok(res, p);
}));

router.post('/pages', wrap(async (req, res) => {
  const { title, slug, content, contentFormat, status, showInNav, sortOrder } = req.body || {};
  if (!title) throw ApiError.badRequest('标题不能为空');
  const s = makeSlug(slug || title, 'page');
  if (await db.one('SELECT id FROM pages WHERE slug=?', [s])) throw ApiError.conflict('别名已存在');
  const r = await db.query(
    'INSERT INTO pages (title,slug,content,content_format,status,show_in_nav,sort_order) VALUES (?,?,?,?,?,?,?)',
    [String(title).slice(0, 200), s, content || '', contentFormat === 'html' ? 'html' : 'markdown',
      status === 'draft' ? 'draft' : 'published', showInNav ? 1 : 0, Number(sortOrder) || 0]
  );
  created(res, { id: r.insertId, slug: s });
}));

router.put('/pages/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db.one('SELECT * FROM pages WHERE id=?', [id]);
  if (!cur) throw ApiError.notFound('页面不存在');
  const b = req.body || {};
  await db.query(
    'UPDATE pages SET title=?, slug=?, content=?, content_format=?, status=?, show_in_nav=?, sort_order=? WHERE id=?',
    [
      b.title != null ? String(b.title).slice(0, 200) : cur.title,
      b.slug ? makeSlug(b.slug, 'page') : cur.slug,
      b.content != null ? b.content : cur.content,
      b.contentFormat === 'html' || b.contentFormat === 'markdown' ? b.contentFormat : cur.content_format,
      b.status === 'draft' || b.status === 'published' ? b.status : cur.status,
      b.showInNav != null ? (b.showInNav ? 1 : 0) : cur.show_in_nav,
      b.sortOrder != null ? Number(b.sortOrder) || 0 : cur.sort_order,
      id,
    ]
  );
  ok(res, { updated: true });
}));

router.delete('/pages/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM pages WHERE id=?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/* ================= 友链 ================= */
router.get('/links', wrap(async (req, res) => {
  ok(res, await db.all('SELECT * FROM links ORDER BY sort_order, id'));
}));

router.post('/links', wrap(async (req, res) => {
  const { name, url, avatar, description, sortOrder, visible } = req.body || {};
  if (!name || !url) throw ApiError.badRequest('名称和链接不能为空');
  const r = await db.query(
    'INSERT INTO links (name,url,avatar,description,sort_order,visible) VALUES (?,?,?,?,?,?)',
    [String(name).slice(0, 80), String(url).slice(0, 500), avatar || null, description || null,
      Number(sortOrder) || 0, visible === false ? 0 : 1]
  );
  created(res, { id: r.insertId });
}));

router.put('/links/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db.one('SELECT * FROM links WHERE id=?', [id]);
  if (!cur) throw ApiError.notFound('友链不存在');
  const b = req.body || {};
  await db.query(
    'UPDATE links SET name=?, url=?, avatar=?, description=?, sort_order=?, visible=? WHERE id=?',
    [
      b.name != null ? String(b.name).slice(0, 80) : cur.name,
      b.url != null ? String(b.url).slice(0, 500) : cur.url,
      b.avatar !== undefined ? b.avatar : cur.avatar,
      b.description !== undefined ? b.description : cur.description,
      b.sortOrder != null ? Number(b.sortOrder) || 0 : cur.sort_order,
      b.visible != null ? (b.visible ? 1 : 0) : cur.visible,
      id,
    ]
  );
  ok(res, { updated: true });
}));

router.delete('/links/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM links WHERE id=?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/* ================= 媒体库 ================= */
router.get('/media', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 24);
  const total = await db.scalar('SELECT COUNT(*) FROM media');
  const rows = await db.all(
    `SELECT m.*, u.display_name AS uploader FROM media m LEFT JOIN users u ON u.id=m.uploader_id
      ORDER BY m.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

router.put('/media/:id', wrap(async (req, res) => {
  const { alt } = req.body || {};
  await db.query('UPDATE media SET alt=? WHERE id=?', [alt ? String(alt).slice(0, 255) : null, Number(req.params.id)]);
  ok(res, { updated: true });
}));

router.delete('/media/:id', wrap(async (req, res) => {
  const row = await db.one('SELECT * FROM media WHERE id=?', [Number(req.params.id)]);
  if (!row) throw ApiError.notFound('文件不存在');
  const uploadDir = path.resolve(load().backend.upload.dir);
  const filePath = path.join(uploadDir, row.stored_name);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  await db.query('DELETE FROM media WHERE id=?', [row.id]);
  ok(res, { deleted: true });
}));

/* ================= 站点设置（覆盖 PBLOG.json 的 sites 部分） ================= */
router.get('/settings', wrap(async (req, res) => {
  const rows = await db.all('SELECT key_name, value_json, updated_at FROM settings');
  const stored = {};
  for (const r of rows) stored[r.key_name] = typeof r.value_json === 'string' ? JSON.parse(r.value_json) : r.value_json;
  const defaults = load().sites;
  ok(res, { defaults, overrides: stored });
}));

/** 支持的设置分区：frontend / theme / themeColors / nav / social / plugins */
const ALLOWED_SETTING_KEYS = ['frontend', 'theme', 'themeColors', 'nav', 'social', 'plugins', 'features', 'backgrounds', 'effects'];

router.put('/settings/:key', wrap(async (req, res) => {
  const key = String(req.params.key);
  if (!ALLOWED_SETTING_KEYS.includes(key)) throw ApiError.badRequest('不支持该设置分区');
  const value = req.body && req.body.value !== undefined ? req.body.value : req.body;
  if (value === undefined || value === null) throw ApiError.badRequest('缺少 value');
  await db.query(
    'INSERT INTO settings (key_name, value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)',
    [key, JSON.stringify(value)]
  );
  await db.query('INSERT INTO audit_logs (user_id, action, target, detail, ip) VALUES (?,?,?,?,?)', [
    req.user.id, 'update_settings', key, JSON.stringify({ keys: Object.keys(value || {}) }), req.ip,
  ]);
  ok(res, { updated: true });
}));

/** 恢复某个分区到配置文件默认值 */
router.delete('/settings/:key', wrap(async (req, res) => {
  const key = String(req.params.key);
  if (!ALLOWED_SETTING_KEYS.includes(key)) throw ApiError.badRequest('不支持该设置分区');
  await db.query('DELETE FROM settings WHERE key_name=?', [key]);
  ok(res, { reset: true });
}));

/* ================= 审计日志 ================= */
router.get('/audit', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 30);
  const total = await db.scalar('SELECT COUNT(*) FROM audit_logs');
  const rows = await db.all(
    `SELECT a.*, u.username FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id
      ORDER BY a.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

module.exports = router;
