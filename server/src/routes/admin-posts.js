'use strict';

/**
 * 管理端：文章 CRUD、批量操作、预览
 * 前缀 /api/admin/posts
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, created, ApiError, parsePaging, pagingMeta } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { makeSlug, countWords, readingTime, extractSummary } = require('../lib/text');
const { renderSafe } = require('../lib/markdown');
const { MemCache } = require('../lib/text');
const { load } = require('../../../config');

const router = express.Router();
router.use(requireAdmin);
const cache = new MemCache((load().features.cacheTtlSeconds || 60) * 1000);

const clean = (s, max) => (s == null ? null : String(s).slice(0, max));

/** 回收站 */
router.get('/trash/list', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT id, title, slug, deleted_at FROM posts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`
  );
  ok(res, rows);
}));

router.post('/trash/:id/restore', wrap(async (req, res) => {
  await db.query('UPDATE posts SET deleted_at = NULL WHERE id = ?', [Number(req.params.id)]);
  cache.clear('posts:');
  ok(res, { restored: true });
}));

router.delete('/trash/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM posts WHERE id = ? AND deleted_at IS NOT NULL', [Number(req.params.id)]);
  ok(res, { purged: true });
}));

/** 列表（含草稿） */
router.get('/', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 20);
  const { status, q, category, tag, sort } = req.query;
  const where = ['p.deleted_at IS NULL'];
  const params = [];

  if (status && status !== 'all') { where.push('p.status = ?'); params.push(status); }
  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (tag) {
    where.push('p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE t.slug=?)');
    params.push(tag);
  }
  if (q) { where.push('(p.title LIKE ? OR p.slug LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const orderMap = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    updated: 'p.updated_at DESC',
    views: 'p.view_count DESC',
    title: 'p.title ASC',
  };
  const order = orderMap[sort] || orderMap.newest;
  const whereSql = where.join(' AND ');
  const total = await db.scalar(`SELECT COUNT(*) FROM posts p WHERE ${whereSql}`, params);
  const rows = await db.all(
    `SELECT p.id, p.title, p.slug, p.summary, p.status, p.is_pinned, p.is_featured, p.cover_image,
            p.view_count, p.like_count, p.reading_time, p.word_count, p.published_at, p.created_at, p.updated_at,
            c.name AS category_name, c.id AS category_id,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id=p.id) AS comment_count
       FROM posts p LEFT JOIN categories c ON c.id=p.category_id
      WHERE ${whereSql} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  ok(res, rows, pagingMeta(total, page, pageSize));
}));

/** 详情（编辑用，含正文） */
router.get('/:id([0-9]+)', wrap(async (req, res) => {
  const post = await db.one('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', [Number(req.params.id)]);
  if (!post) throw ApiError.notFound('文章不存在');
  const tags = await db.all(
    `SELECT t.id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=?`, [post.id]
  );
  ok(res, { ...post, tags });
}));

/** 写入公共逻辑 */
async function saveTags(conn, postId, tagNames) {
  await conn.execute('DELETE FROM post_tags WHERE post_id = ?', [postId]);
  if (!Array.isArray(tagNames)) return;
  for (const raw of tagNames.slice(0, 20)) {
    const name = String(raw).trim().slice(0, 60);
    if (!name) continue;
    const slug = makeSlug(name, 'tag');
    const [exist] = await conn.execute('SELECT id FROM tags WHERE name = ? OR slug = ? LIMIT 1', [name, slug]);
    let tagId;
    if (exist.length) tagId = exist[0].id;
    else {
      const [r] = await conn.execute('INSERT INTO tags (name, slug) VALUES (?,?)', [name, slug]);
      tagId = r.insertId;
    }
    await conn.execute('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)', [postId, tagId]);
  }
}

/** 新建 */
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) throw ApiError.badRequest('标题不能为空');
  if (!b.content || !String(b.content).trim()) throw ApiError.badRequest('正文不能为空');

  const title = String(b.title).trim().slice(0, 200);
  let slug = clean(b.slug, 220) || makeSlug(title);
  const exists = await db.one('SELECT id FROM posts WHERE slug = ?', [slug]);
  if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const status = ['draft', 'published', 'scheduled', 'private'].includes(b.status) ? b.status : 'draft';
  const publishedAt = b.publishedAt ? new Date(b.publishedAt)
    : (status === 'published' || status === 'scheduled' ? new Date() : null);

  const content = String(b.content);
  const words = countWords(content);

  const id = await db.tx(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO posts
        (title, slug, summary, content, content_format, cover_image, author_id, category_id, status,
         is_pinned, is_featured, allow_comment, word_count, reading_time,
         seo_title, seo_description, published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title, slug,
        clean(b.summary, 500) || extractSummary(content),
        content, b.contentFormat === 'html' ? 'html' : 'markdown',
        clean(b.coverImage, 500), req.user.id,
        b.categoryId ? Number(b.categoryId) : null,
        status,
        b.isPinned ? 1 : 0, b.isFeatured ? 1 : 0, b.allowComment === false ? 0 : 1,
        words, readingTime(content),
        clean(b.seoTitle, 200), clean(b.seoDescription, 500),
        publishedAt,
      ]
    );
    await saveTags(conn, r.insertId, b.tags);
    return r.insertId;
  });

  cache.clear('posts:');
  created(res, { id, slug });
}));

/** 更新 */
router.put('/:id([0-9]+)', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const post = await db.one('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', [id]);
  if (!post) throw ApiError.notFound('文章不存在');

  const b = req.body || {};
  const title = b.title != null ? String(b.title).trim().slice(0, 200) : post.title;
  if (!title) throw ApiError.badRequest('标题不能为空');
  const content = b.content != null ? String(b.content) : post.content;
  const words = countWords(content);

  const status = b.status && ['draft', 'published', 'scheduled', 'private'].includes(b.status) ? b.status : post.status;
  let publishedAt = b.publishedAt !== undefined
    ? (b.publishedAt ? new Date(b.publishedAt) : null)
    : post.published_at;
  if (!publishedAt && (status === 'published' || status === 'scheduled')) publishedAt = new Date();

  await db.tx(async (conn) => {
    await conn.execute(
      `UPDATE posts SET title=?, slug=?, summary=?, content=?, content_format=?, cover_image=?,
        category_id=?, status=?, is_pinned=?, is_featured=?, allow_comment=?,
        word_count=?, reading_time=?, seo_title=?, seo_description=?, published_at=?
       WHERE id=?`,
      [
        title,
        clean(b.slug, 220) || post.slug,
        b.summary !== undefined ? (clean(b.summary, 500) || extractSummary(content)) : post.summary,
        content,
        b.contentFormat === 'html' ? 'html' : (b.contentFormat === 'markdown' ? 'markdown' : post.content_format),
        b.coverImage !== undefined ? clean(b.coverImage, 500) : post.cover_image,
        b.categoryId !== undefined ? (b.categoryId ? Number(b.categoryId) : null) : post.category_id,
        status,
        b.isPinned !== undefined ? (b.isPinned ? 1 : 0) : post.is_pinned,
        b.isFeatured !== undefined ? (b.isFeatured ? 1 : 0) : post.is_featured,
        b.allowComment !== undefined ? (b.allowComment ? 1 : 0) : post.allow_comment,
        words, readingTime(content),
        b.seoTitle !== undefined ? clean(b.seoTitle, 200) : post.seo_title,
        b.seoDescription !== undefined ? clean(b.seoDescription, 500) : post.seo_description,
        publishedAt,
        id,
      ]
    );
    if (b.tags !== undefined) await saveTags(conn, id, b.tags);
  });

  cache.clear('posts:');
  ok(res, { updated: true });
}));

/** 单个字段快捷切换（置顶/推荐/状态） */
router.patch('/:id([0-9]+)', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['is_pinned', 'is_featured', 'allow_comment', 'status'];
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!allowed.includes(k)) continue;
    sets.push(`${k} = ?`);
    params.push(k === 'status' ? String(v) : (v ? 1 : 0));
  }
  if (!sets.length) throw ApiError.badRequest('没有可更新的字段');
  params.push(id);
  await db.query(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`, params);
  cache.clear('posts:');
  ok(res, { updated: true });
}));

/** 软删除 */
router.delete('/:id([0-9]+)', wrap(async (req, res) => {
  const id = Number(req.params.id);
  await db.query('UPDATE posts SET deleted_at = NOW() WHERE id = ?', [id]);
  cache.clear('posts:');
  ok(res, { deleted: true });
}));

/** 批量操作 */
router.post('/batch', wrap(async (req, res) => {
  const { ids, action } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('缺少 ids');
  const list = ids.map(Number).filter(Boolean).slice(0, 200);
  const ph = list.map(() => '?').join(',');
  switch (action) {
    case 'publish':
      await db.query(`UPDATE posts SET status='published', published_at=COALESCE(published_at, NOW()) WHERE id IN (${ph})`, list);
      break;
    case 'draft':
      await db.query(`UPDATE posts SET status='draft' WHERE id IN (${ph})`, list);
      break;
    case 'pin':
      await db.query(`UPDATE posts SET is_pinned=1 WHERE id IN (${ph})`, list);
      break;
    case 'unpin':
      await db.query(`UPDATE posts SET is_pinned=0 WHERE id IN (${ph})`, list);
      break;
    case 'delete':
      await db.query(`UPDATE posts SET deleted_at=NOW() WHERE id IN (${ph})`, list);
      break;
    default:
      throw ApiError.badRequest('未知的批量操作');
  }
  cache.clear('posts:');
  ok(res, { affected: list.length, action });
}));

/** 预览（返回渲染后的 HTML 与目录） */
router.post('/preview', wrap(async (req, res) => {
  const { content, format } = req.body || {};
  if (format === 'html') {
    const { sanitize } = require('../lib/markdown');
    return ok(res, { html: sanitize(content || ''), toc: [] });
  }
  ok(res, renderSafe(content || ''));
}));

module.exports = router;
