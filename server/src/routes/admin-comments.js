'use strict';

/**
 * 管理端：评论管理
 * 前缀 /api/admin/comments
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, ApiError, parsePaging, pagingMeta } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 20);
  const status = req.query.status || 'all';
  const q = req.query.q;
  const where = [];
  const params = [];
  if (status !== 'all') { where.push('cm.status = ?'); params.push(status); }
  if (q) { where.push('(cm.content LIKE ? OR cm.author_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = await db.scalar(`SELECT COUNT(*) FROM comments cm ${whereSql}`, params);
  const rows = await db.all(
    `SELECT cm.*, p.title AS post_title, p.slug AS post_slug, pg.title AS page_title,
            (SELECT COUNT(*) FROM comments r WHERE r.parent_id = cm.id) AS reply_count
       FROM comments cm
       LEFT JOIN posts p ON p.id = cm.post_id
       LEFT JOIN pages pg ON pg.id = cm.page_id
       ${whereSql}
      ORDER BY cm.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  // 统计各状态数量
  const counts = await db.all(`SELECT status, COUNT(*) AS n FROM comments GROUP BY status`);
  const counter = { pending: 0, approved: 0, spam: 0, rejected: 0 };
  for (const c of counts) counter[c.status] = c.n;
  ok(res, rows, { ...pagingMeta(total, page, pageSize), counts: counter });
}));

/** 审核：修改状态 */
router.patch('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['pending', 'approved', 'spam', 'rejected'].includes(status)) throw ApiError.badRequest('状态不合法');
  await db.query('UPDATE comments SET status=? WHERE id=?', [status, id]);
  ok(res, { updated: true, status });
}));

/** 管理员回复 */
router.post('/:id/reply', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parent = await db.one('SELECT * FROM comments WHERE id=?', [id]);
  if (!parent) throw ApiError.notFound('评论不存在');
  const content = String(req.body?.content || '').trim();
  if (content.length < 1) throw ApiError.badRequest('回复内容不能为空');

  const me = await db.one('SELECT display_name, email FROM users WHERE id=?', [req.user.id]);
  const r = await db.query(
    `INSERT INTO comments (post_id, page_id, parent_id, author_name, author_email, content, status, is_admin)
     VALUES (?,?,?,?,?,?,'approved',1)`,
    [parent.post_id, parent.page_id, parent.id, me.display_name || '管理员', me.email, content.slice(0, 5000)]
  );
  ok(res, { id: r.insertId });
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM comments WHERE id=?', [Number(req.params.id)]);
  ok(res, { deleted: true });
}));

/** 批量审核 */
router.post('/batch', wrap(async (req, res) => {
  const { ids, action } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('缺少 ids');
  const list = ids.map(Number).filter(Boolean).slice(0, 200);
  const ph = list.map(() => '?').join(',');
  if (action === 'delete') {
    await db.query(`DELETE FROM comments WHERE id IN (${ph})`, list);
  } else if (['pending', 'approved', 'spam', 'rejected'].includes(action)) {
    await db.query(`UPDATE comments SET status=? WHERE id IN (${ph})`, [action, ...list]);
  } else {
    throw ApiError.badRequest('未知操作');
  }
  ok(res, { affected: list.length });
}));

module.exports = router;
