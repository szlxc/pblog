'use strict';

/**
 * 管理端：仪表盘统计
 * 前缀 /api/admin/dashboard
 */
const express = require('express');
const db = require('../db');
const { wrap, ok } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/', wrap(async (req, res) => {
  const [posts, drafts, scheduled, comments, pendingComments, views, likes, media, tags] = await Promise.all([
    db.scalar(`SELECT COUNT(*) FROM posts WHERE status='published' AND deleted_at IS NULL`),
    db.scalar(`SELECT COUNT(*) FROM posts WHERE status='draft' AND deleted_at IS NULL`),
    db.scalar(`SELECT COUNT(*) FROM posts WHERE status='scheduled' AND deleted_at IS NULL`),
    db.scalar('SELECT COUNT(*) FROM comments'),
    db.scalar(`SELECT COUNT(*) FROM comments WHERE status='pending'`),
    // 总阅读量以真实访问记录为准，避免 view_count 被历史脏数据污染
    db.scalar('SELECT COUNT(*) FROM page_views'),
    db.scalar('SELECT COALESCE(SUM(like_count),0) FROM posts WHERE deleted_at IS NULL'),
    db.scalar('SELECT COUNT(*) FROM media'),
    db.scalar('SELECT COUNT(*) FROM tags'),
  ]);

  // 近 14 天浏览量
  // 注意：日期以「数据库时区」为准，不能用 JS 的 toISOString()（那是 UTC），
  // 否则北京时间 0-8 点的数据会落到前一天，导致「今天」永远显示 0。
  const trend = await db.all(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS views
       FROM page_views WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY day ORDER BY day ASC`
  );
  const dayMap = new Map(trend.map((t) => [t.day, Number(t.views)]));

  // 工作日历也用数据库的 CURDATE 生成，保证与上面一致
  const days = await db.all(
    `SELECT DATE_FORMAT(dt, '%Y-%m-%d') AS day
       FROM (
         SELECT DATE_SUB(CURDATE(), INTERVAL seq DAY) AS dt
         FROM (
           SELECT 0 seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
           UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
           UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
           UNION ALL SELECT 12 UNION ALL SELECT 13
         ) t
       ) d ORDER BY dt ASC`
  );
  const series = days.map((d) => ({ day: d.day, views: dayMap.get(d.day) || 0 }));

  const topPosts = await db.all(
    `SELECT id, title, slug, view_count, like_count, published_at FROM posts
      WHERE deleted_at IS NULL AND status='published' ORDER BY view_count DESC LIMIT 5`
  );

  const recentComments = await db.all(
    `SELECT cm.id, cm.author_name, cm.content, cm.status, cm.created_at, p.title AS post_title
       FROM comments cm LEFT JOIN posts p ON p.id = cm.post_id
      ORDER BY cm.created_at DESC LIMIT 6`
  );

  const recentPosts = await db.all(
    `SELECT id, title, slug, status, created_at, updated_at FROM posts WHERE deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 6`
  );

  const categoryDist = await db.all(
    `SELECT c.name, COUNT(p.id) AS n FROM categories c
       LEFT JOIN posts p ON p.category_id=c.id AND p.deleted_at IS NULL
      GROUP BY c.id ORDER BY n DESC LIMIT 8`
  );

  const todayViews = await db.scalar(
    'SELECT COUNT(*) FROM page_views WHERE DATE(created_at) = CURDATE()'
  );

  ok(res, {
    counters: {
      posts, drafts, scheduled, comments, pendingComments,
      views, todayViews: Number(todayViews) || 0,
      likes, media, tags,
    },
    traffic: series,
    topPosts,
    recentComments,
    recentPosts,
    categoryDist,
  });
}));

module.exports = router;
