'use strict';

/**
 * 管理端：分类与标签
 * 前缀 /api/admin
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, created, ApiError } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { makeSlug } = require('../lib/text');

const router = express.Router();
router.use(requireAdmin);

/* ---------------- 分类 ---------------- */
router.get('/categories', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id=c.id AND p.deleted_at IS NULL) AS post_count
       FROM categories c ORDER BY c.sort_order ASC, c.id ASC`
  );
  ok(res, rows);
}));

router.post('/categories', wrap(async (req, res) => {
  const { name, slug, description, color, parentId, sortOrder } = req.body || {};
  if (!name || !String(name).trim()) throw ApiError.badRequest('分类名称不能为空');
  const s = makeSlug(slug || name, 'cat');
  if (await db.one('SELECT id FROM categories WHERE slug=?', [s])) throw ApiError.conflict('该别名已存在');
  const r = await db.query(
    'INSERT INTO categories (name, slug, description, color, parent_id, sort_order) VALUES (?,?,?,?,?,?)',
    [String(name).trim().slice(0, 80), s, description || null, color || null, parentId || null, Number(sortOrder) || 0]
  );
  created(res, { id: r.insertId, slug: s });
}));

router.put('/categories/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db.one('SELECT * FROM categories WHERE id=?', [id]);
  if (!cur) throw ApiError.notFound('分类不存在');
  const { name, slug, description, color, parentId, sortOrder } = req.body || {};
  if (parentId && Number(parentId) === id) throw ApiError.badRequest('不能把自己设为父分类');
  await db.query(
    'UPDATE categories SET name=?, slug=?, description=?, color=?, parent_id=?, sort_order=? WHERE id=?',
    [
      name != null ? String(name).trim().slice(0, 80) : cur.name,
      slug ? makeSlug(slug, 'cat') : cur.slug,
      description !== undefined ? description : cur.description,
      color !== undefined ? color : cur.color,
      parentId !== undefined ? (parentId || null) : cur.parent_id,
      sortOrder !== undefined ? Number(sortOrder) || 0 : cur.sort_order,
      id,
    ]
  );
  ok(res, { updated: true });
}));

router.delete('/categories/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const used = await db.scalar('SELECT COUNT(*) FROM posts WHERE category_id=? AND deleted_at IS NULL', [id]);
  if (used > 0) throw ApiError.conflict(`该分类下还有 ${used} 篇文章，请先移出`);
  await db.query('DELETE FROM categories WHERE id=?', [id]);
  ok(res, { deleted: true });
}));

/* ---------------- 标签 ---------------- */
router.get('/tags', wrap(async (req, res) => {
  ok(res, await db.all(
    `SELECT t.*, COUNT(pt.post_id) AS post_count FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id=t.id
       LEFT JOIN posts p ON p.id=pt.post_id AND p.deleted_at IS NULL
      GROUP BY t.id ORDER BY post_count DESC, t.name ASC`
  ));
}));

router.post('/tags', wrap(async (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !String(name).trim()) throw ApiError.badRequest('标签名不能为空');
  const n = String(name).trim().slice(0, 60);
  const s = makeSlug(n, 'tag');
  const exist = await db.one('SELECT id FROM tags WHERE name=? OR slug=?', [n, s]);
  if (exist) throw ApiError.conflict('标签已存在');
  const r = await db.query('INSERT INTO tags (name, slug, color) VALUES (?,?,?)', [n, s, color || null]);
  created(res, { id: r.insertId, slug: s });
}));

router.put('/tags/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db.one('SELECT * FROM tags WHERE id=?', [id]);
  if (!cur) throw ApiError.notFound('标签不存在');
  const { name, color } = req.body || {};
  await db.query('UPDATE tags SET name=?, slug=?, color=? WHERE id=?', [
    name ? String(name).trim().slice(0, 60) : cur.name,
    name ? makeSlug(name, 'tag') : cur.slug,
    color !== undefined ? color : cur.color,
    id,
  ]);
  ok(res, { updated: true });
}));

router.delete('/tags/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM tags WHERE id=?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/** 标签合并：把 source 合并到 target */
router.post('/tags/merge', wrap(async (req, res) => {
  const { sourceId, targetId } = req.body || {};
  if (!sourceId || !targetId || Number(sourceId) === Number(targetId)) throw ApiError.badRequest('参数有误');
  await db.tx(async (conn) => {
    await conn.execute(
      'INSERT IGNORE INTO post_tags (post_id, tag_id) SELECT post_id, ? FROM post_tags WHERE tag_id = ?',
      [Number(targetId), Number(sourceId)]
    );
    await conn.execute('DELETE FROM tags WHERE id = ?', [Number(sourceId)]);
  });
  ok(res, { merged: true });
}));

module.exports = router;
