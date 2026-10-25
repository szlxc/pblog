'use strict';

/**
 * 公共 API —— 前台博客使用，无需登录
 * 挂载前缀 /api
 */
const express = require('express');
const db = require('../db');
const { wrap, ok, ApiError, parsePaging, pagingMeta } = require('../lib/http');
const { renderSafe } = require('../lib/markdown');
const { MemCache, sha256 } = require('../lib/text');
const { load } = require('../../../config');

const router = express.Router();
const cache = new MemCache((load().features.cacheTtlSeconds || 60) * 1000);

/**
 * 前台可见的文章
 *
 * 注意 published_at 的比较：
 *   文章被标记为 published 时，published_at 一定已经写入（发布接口保证）。
 *   因此这里只要 status='published' 就应该可见，不应再用 NOW() 做时间过滤——
 *   否则一旦数据库时区与写入时区不一致，刚发布的文章会被误判为「未来文章」而隐藏。
 *
 *   真正需要时间过滤的只有 status='scheduled'（定时发布），单独处理。
 */
const PUBLISHED = `(
  p.deleted_at IS NULL AND (
    p.status = 'published'
    -- 定时文章：到点后自动出现在前台
    OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= NOW())
  )
)`;

/* ------------------------------ 站点信息 ------------------------------ */
router.get('/site', wrap(async (req, res) => {
  const siteConfig = load().sites;
  const settingsRows = await db.all('SELECT key_name, value_json FROM settings');
  const stored = {};
  for (const r of settingsRows) stored[r.key_name] = typeof r.value_json === 'string' ? JSON.parse(r.value_json) : r.value_json;

  const pages = await db.all(
    `SELECT id, title, slug FROM pages WHERE status='published' AND show_in_nav=1 ORDER BY sort_order ASC, id ASC`
  );

  ok(res, {
    frontend: { ...siteConfig.frontend, ...(stored.frontend || {}) },
    theme: { ...siteConfig.theme, ...(stored.theme || {}) },
    themeColors: stored.themeColors || siteConfig.themeColors,
    nav: stored.nav || siteConfig.nav,
    social: stored.social || siteConfig.social,
    plugins: { ...siteConfig.plugins, ...(stored.plugins || {}) },
    music: normalizeMusic(stored.music),
    community: {
      registerOpen: stored.features?.allowRegistration !== undefined
        ? !!stored.features.allowRegistration
        : !!load().features.allowRegistration,
      requireEmailVerify: !!(stored.mail && stored.mail.enabled && stored.mail.requireVerify),
      chatEnabled: (stored.plugins?.chat !== undefined ? !!stored.plugins.chat : siteConfig.plugins.chat !== false),
      guestbookEnabled: (stored.plugins?.guestbook !== undefined ? !!stored.plugins.guestbook : siteConfig.plugins.guestbook !== false),
    },
    guestbookStyle: normalizeGuestbookStyle(stored.guestbook_style),
    backgrounds: normalizeBackgrounds(stored.backgrounds),
    // 点击特效配置
    effects: (() => {
      const e = stored.effects || {};
      return {
        click: {
          enabled: e.click?.enabled === true,
          style: ['bluearchive', 'confetti', 'ripple', 'spark'].includes(e.click?.style)
            ? e.click.style : 'bluearchive',
          color: /^#[0-9a-fA-F]{6}$/.test(e.click?.color || '') ? e.click.color : '',
          trail: e.click?.trail !== false,   // 默认开启：移动即出现拖尾
        },
      };
    })(),
    // UAPI 只暴露开关，绝不包含 token
    uapi: (() => {
      const u = stored.uapi || {};
      return {
        enabled: u.enabled !== undefined ? !!u.enabled : false,
        features: {
          saying: u.features?.saying !== false,
          bingWallpaper: u.features?.bingWallpaper !== false,
          hotboard: u.features?.hotboard === true,
          weather: u.features?.weather === true,
        },
        hotboardType: u.hotboardType || 'zhihu',
        city: u.city || '北京',
      };
    })(),
    pages,
    stats: {
      posts: await db.scalar(`SELECT COUNT(*) FROM posts p WHERE ${PUBLISHED}`),
      tags: await db.scalar('SELECT COUNT(*) FROM tags'),
      categories: await db.scalar('SELECT COUNT(*) FROM categories'),
      comments: await db.scalar(`SELECT COUNT(*) FROM comments WHERE status='approved'`),
    },
  });
}));

/* ------------------------------ 文章列表 ------------------------------ */
router.get('/posts', wrap(async (req, res) => {
  const { page, pageSize, offset } = parsePaging(req.query, 10);
  const { tag, category, q, year, month, featured, pinned } = req.query;

  const where = [PUBLISHED];
  const params = [];

  if (tag) {
    where.push(`p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE t.slug = ?)`);
    params.push(tag);
  }
  if (category) {
    // 选中某个分类时，包含它自身 + 它的所有子分类
    where.push(`p.category_id IN (
      SELECT id FROM categories WHERE slug = ?
      UNION
      SELECT child.id FROM categories child
        JOIN categories parent ON parent.id = child.parent_id
       WHERE parent.slug = ?
    )`);
    params.push(category, category);
  }
  if (featured === '1') where.push('p.is_featured = 1');
  if (pinned === '1') where.push('p.is_pinned = 1');
  if (year) { where.push('YEAR(p.published_at) = ?'); params.push(Number(year)); }
  if (month) { where.push('MONTH(p.published_at) = ?'); params.push(Number(month)); }
  if (q && String(q).trim()) {
    const kw = `%${String(q).trim()}%`;
    where.push('(p.title LIKE ? OR p.summary LIKE ? OR p.content LIKE ?)');
    params.push(kw, kw, kw);
  }

  const whereSql = where.join(' AND ');
  const total = await db.scalar(`SELECT COUNT(*) FROM posts p WHERE ${whereSql}`, params);

  const rows = await db.all(
    `SELECT p.id, p.title, p.slug, p.summary, p.cover_image, p.is_pinned, p.is_featured,
            p.view_count, p.like_count, p.word_count, p.reading_time, p.published_at, p.created_at,
            p.allow_comment,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name, u.avatar AS author_avatar,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status='approved') AS comment_count
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
      WHERE ${whereSql}
      ORDER BY p.is_pinned DESC, p.published_at DESC, p.id DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  const ids = rows.map((r) => r.id);
  const tagMap = {};
  if (ids.length) {
    const tagRows = await db.all(
      `SELECT pt.post_id, t.id, t.name, t.slug, t.color FROM post_tags pt
        JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id IN (${ids.map(() => '?').join(',')})
        ORDER BY t.name`,
      ids
    );
    for (const t of tagRows) (tagMap[t.post_id] = tagMap[t.post_id] || []).push(t);
  }

  ok(res, rows.map((r) => ({ ...r, tags: tagMap[r.id] || [] })), pagingMeta(total, page, pageSize));
}));

/* ------------------------------ 文章详情 ------------------------------ */
router.get('/posts/:slug', wrap(async (req, res) => {
  const post = await db.one(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            u.display_name AS author_name, u.avatar AS author_avatar, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
      WHERE p.slug = ? AND p.deleted_at IS NULL LIMIT 1`,
    [req.params.slug]
  );
  if (!post || (post.status !== 'published' && post.status !== 'scheduled')) throw ApiError.notFound('文章不存在');
  if (post.status === 'scheduled' && new Date(post.published_at) > new Date()) throw ApiError.notFound('文章尚未发布');

  const tags = await db.all(
    `SELECT t.id, t.name, t.slug, t.color FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=?`,
    [post.id]
  );

  let rendered;
  if (post.content_format === 'html') {
    const { sanitize } = require('../lib/markdown');
    rendered = { html: sanitize(post.content), toc: [] };
  } else {
    rendered = renderSafe(post.content);
  }

  // 上一篇 / 下一篇
  const prev = await db.one(
    `SELECT title, slug FROM posts p WHERE ${PUBLISHED} AND p.published_at > ? ORDER BY p.published_at ASC LIMIT 1`,
    [post.published_at]
  );
  const next = await db.one(
    `SELECT title, slug FROM posts p WHERE ${PUBLISHED} AND p.published_at < ? ORDER BY p.published_at DESC LIMIT 1`,
    [post.published_at]
  );
  const related = await db.all(
    `SELECT p.id, p.title, p.slug, p.cover_image, p.published_at FROM posts p
      WHERE ${PUBLISHED} AND p.id <> ?
        AND (p.category_id = ? OR p.id IN (SELECT post_id FROM post_tags WHERE tag_id IN (SELECT tag_id FROM post_tags WHERE post_id = ?)))
      GROUP BY p.id ORDER BY p.published_at DESC LIMIT 3`,
    [post.id, post.category_id || 0, post.id]
  );

  delete post.content;
  ok(res, { post: { ...post, tags }, html: rendered.html, toc: rendered.toc, prev, next, related });
}));

/* ------------------------------ 归档 ------------------------------ */
router.get('/archive', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT id, title, slug, published_at, reading_time FROM posts p
      WHERE ${PUBLISHED} ORDER BY p.published_at DESC`
  );
  const groups = new Map();
  for (const r of rows) {
    const d = new Date(r.published_at || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, { month: key, year: d.getFullYear(), items: [] });
    groups.get(key).items.push(r);
  }
  ok(res, Array.from(groups.values()));
}));

/* ------------------------------ 分类 & 标签 ------------------------------ */
router.get('/categories', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id=c.id AND ${PUBLISHED}) AS post_count
       FROM categories c ORDER BY c.sort_order ASC, c.id ASC`
  );
  const map = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const r of map.values()) {
    if (r.parent_id && map.has(r.parent_id)) map.get(r.parent_id).children.push(r);
    else roots.push(r);
  }
  ok(res, roots);
}));

router.get('/tags', wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT t.*, COUNT(pt.post_id) AS post_count
       FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       JOIN posts p ON p.id = pt.post_id AND ${PUBLISHED}
      GROUP BY t.id HAVING post_count > 0
      ORDER BY post_count DESC, t.name ASC`
  );
  ok(res, rows);
}));

/* ------------------------------ 独立页面 ------------------------------ */
router.get('/pages', wrap(async (req, res) => {
  ok(res, await db.all(`SELECT id,title,slug,show_in_nav,sort_order FROM pages WHERE status='published' ORDER BY sort_order ASC`));
}));

router.get('/pages/:slug', wrap(async (req, res) => {
  const page = await db.one(`SELECT * FROM pages WHERE slug=? AND status='published' LIMIT 1`, [req.params.slug]);
  if (!page) throw ApiError.notFound('页面不存在');
  const rendered = page.content_format === 'html'
    ? { html: require('../lib/markdown').sanitize(page.content), toc: [] }
    : renderSafe(page.content);
  delete page.content;
  ok(res, { page, html: rendered.html, toc: rendered.toc });
}));

/* ------------------------------ 友链 ------------------------------ */
router.get('/links', wrap(async (req, res) => {
  ok(res, await db.all(`SELECT id,name,url,avatar,description FROM links WHERE visible=1 ORDER BY sort_order ASC, id ASC`));
}));

/* ------------------------------ 评论读取 ------------------------------ */
router.get('/comments', wrap(async (req, res) => {
  const { postSlug, pageSlug, postId, pageId } = req.query;
  let where = `cm.status='approved'`;
  const params = [];
  if (postId) { where += ' AND cm.post_id = ?'; params.push(Number(postId)); }
  else if (postSlug) {
    where += ' AND cm.post_id = (SELECT id FROM posts WHERE slug=?)';
    params.push(postSlug);
  }
  if (pageId) { where += ' AND cm.page_id = ?'; params.push(Number(pageId)); }
  else if (pageSlug) {
    where += ' AND cm.page_id = (SELECT id FROM pages WHERE slug=?)';
    params.push(pageSlug);
  }
  const rows = await db.all(
    `SELECT cm.id, cm.post_id, cm.page_id, cm.parent_id, cm.author_name, cm.author_site,
            cm.content, cm.is_admin, cm.created_at
       FROM comments cm WHERE ${where} ORDER BY cm.created_at ASC`,
    params
  );
  // 组装两层树（parent + replies）
  const byId = new Map();
  const roots = [];
  for (const r of rows) byId.set(r.id, { ...r, replies: [] });
  for (const r of byId.values()) {
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).replies.push(r);
    else roots.push(r);
  }
  ok(res, roots);
}));

/* ------------------------------ 提交评论 ------------------------------ */
router.post('/comments', wrap(async (req, res) => {
  const { postId, pageId, parentId, authorName, authorEmail, authorSite, content } = req.body || {};
  if (!content || String(content).trim().length < 2) throw ApiError.badRequest('评论内容太短');
  if (String(content).length > 5000) throw ApiError.badRequest('评论内容过长');
  if (!authorName || String(authorName).trim().length < 1) throw ApiError.badRequest('请填写昵称');

  // 蜜罐字段：机器人会填，人不会
  if (req.body && req.body.website) { return ok(res, { status: 'approved' }); }

  const cfg = load();
  const moderation = cfg.features.commentModeration !== false;
  const status = moderation ? 'pending' : 'approved';

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
  const result = await db.query(
    `INSERT INTO comments (post_id, page_id, parent_id, author_name, author_email, author_site, content, status, ip_hash, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      postId || null, pageId || null, parentId || null,
      String(authorName).slice(0, 80),
      authorEmail ? String(authorEmail).slice(0, 190) : null,
      authorSite ? String(authorSite).slice(0, 250) : null,
      String(content).trim(),
      status,
      sha256(ip).slice(0, 64),
      String(req.headers['user-agent'] || '').slice(0, 250),
    ]
  );
  ok(res, { id: result.insertId, status });
}));

/* ------------------------------ 点赞 ------------------------------ */
router.post('/posts/:slug/like', wrap(async (req, res) => {
  const lrow = await db.one("SELECT value_json FROM settings WHERE key_name='plugins' LIMIT 1").catch(() => null);
  const lplugins = lrow ? (typeof lrow.value_json === 'string' ? JSON.parse(lrow.value_json) : lrow.value_json) : {};
  const likeOn = lplugins.likes !== undefined
    ? !!lplugins.likes
    : (load().sites.plugins.likes !== false && load().features.postLikes !== false);
  if (!likeOn) throw ApiError.forbidden('点赞功能已关闭');
  const post = await db.one(`SELECT id, like_count FROM posts p WHERE slug=? AND ${PUBLISHED}`, [req.params.slug]);
  if (!post) throw ApiError.notFound('文章不存在');
  await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [post.id]);
  cache.clear('posts:');
  ok(res, { likeCount: post.like_count + 1 });
}));

/* ------------------------------ 阅读量上报 ------------------------------ */
router.post('/posts/:slug/view', wrap(async (req, res) => {
  // 开关在 sites.plugins.viewCounter（管理端可改，存于 settings.plugins）
  const srow = await db.one("SELECT value_json FROM settings WHERE key_name='plugins' LIMIT 1").catch(() => null);
  const stored = srow ? (typeof srow.value_json === 'string' ? JSON.parse(srow.value_json) : srow.value_json) : {};
  const viewOn = stored.viewCounter !== undefined
    ? !!stored.viewCounter
    : load().sites.plugins.viewCounter !== false;
  if (!viewOn) return ok(res, { counted: false, reason: 'disabled' });
  const post = await db.one(`SELECT id FROM posts p WHERE slug=? AND ${PUBLISHED}`, [req.params.slug]);
  if (!post) throw ApiError.notFound('文章不存在');
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
  const vk = sha256(ip + (req.headers['user-agent'] || '')).slice(0, 32);

  // 同一访客 + 同一篇文章，1 小时内只计一次（防刷新刷量）
  const dedupeKey = `view:${post.id}:${vk}`;
  if (cache.get(dedupeKey)) {
    return ok(res, { counted: false, reason: 'duplicate' });
  }

  await db.query(
    'INSERT INTO page_views (post_id, path, visitor_key, referer) VALUES (?,?,?,?)',
    [post.id, req.path.slice(0, 250), vk, String(req.headers.referer || '').slice(0, 490)]
  );
  await db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [post.id]);
  cache.set(dedupeKey, true, 3600_000);

  ok(res, { counted: true });
}));

/* ------------------------------ RSS & Sitemap ------------------------------ */
router.get('/rss', wrap(async (req, res) => {
  if (!load().sites.plugins.rss) throw ApiError.notFound();
  const site = load().sites.frontend;
  const base = load().backend.publicUrl.replace(/\/$/, '');
  const posts = await db.all(
    `SELECT title, slug, summary, published_at FROM posts p WHERE ${PUBLISHED} ORDER BY p.published_at DESC LIMIT 30`
  );
  const { escapeHtml } = require('../lib/text');
  const items = posts.map((p) => `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${base}/post/${encodeURIComponent(p.slug)}</link>
      <guid isPermaLink="true">${base}/post/${encodeURIComponent(p.slug)}</guid>
      <pubDate>${new Date(p.published_at || Date.now()).toUTCString()}</pubDate>
      <description>${escapeHtml(p.summary || '')}</description>
    </item>`).join('');
  res.type('application/rss+xml; charset=utf-8').send(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
      <title>${escapeHtml(site.title)}</title>
      <link>${base}</link>
      <description>${escapeHtml(site.description)}</description>
      <language>zh-CN</language>${items}
    </channel></rss>`
  );
}));

router.get('/sitemap.xml', wrap(async (req, res) => {
  const base = load().backend.publicUrl.replace(/\/$/, '');
  const posts = await db.all(`SELECT slug, updated_at FROM posts p WHERE ${PUBLISHED}`);
  const pages = await db.all(`SELECT slug, updated_at FROM pages WHERE status='published'`);
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq></url>`,
    ...posts.map((p) => `<url><loc>${base}/post/${encodeURIComponent(p.slug)}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`),
    ...pages.map((p) => `<url><loc>${base}/p/${encodeURIComponent(p.slug)}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`),
  ].join('');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
  );
}));

/**
 * 音乐配置对外输出：只暴露前台渲染 iframe 所需的字段
 * 网易云外链播放器地址：
 *   歌单 https://music.163.com/outchain/player?type=0&id=<playlistId>&auto=0&height=66
 *   单曲 https://music.163.com/outchain/player?type=2&id=<songId>&auto=0&height=66
 */
function normalizeMusic(stored) {
  const base = {
    enabled: false,
    provider: 'netease',
    playlistId: '',
    songId: '',
    theme: '#6ee7b7',
    autoPlay: false,
    homeOnly: false,
    defaultOpen: false,
  };
  if (!stored) return base;
  const m = { ...base, ...stored };
  if (!m.enabled) return { ...m, embedUrl: '' };
  const id = m.playlistId || m.songId;
  const type = m.playlistId ? 0 : 2;
  const embedUrl = id
    ? `https://music.163.com/outchain/player?type=${type}&id=${encodeURIComponent(id)}&auto=${m.autoPlay ? 1 : 0}&height=66`
    : '';
  return { ...m, embedUrl };
}

/**
 * 留言墙弹幕外观（对外输出）
 * 后台可配置颜色池、字号范围、速度、轨道数等
 */
function normalizeGuestbookStyle(stored) {
  const base = {
    speed: 70,
    minFontSize: 14,
    maxFontSize: 26,
    colors: ['#e8edf2', '#6ee7b7', '#818cf8', '#fbbf24', '#fb7185', '#67e8f9', '#cbd5e1'],
    lanes: 8,
    maxOnScreen: 18,
    pauseSeconds: 5,
    showMood: true,
  };
  if (!stored) return base;
  const m = { ...base, ...stored };
  // 防御：颜色必须合法十六进制
  m.colors = (Array.isArray(m.colors) ? m.colors : base.colors)
    .filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c));
  if (!m.colors.length) m.colors = base.colors;
  m.minFontSize = Math.min(28, Math.max(11, Number(m.minFontSize) || 14));
  m.maxFontSize = Math.min(40, Math.max(m.minFontSize, Number(m.maxFontSize) || 26));
  m.lanes = Math.min(16, Math.max(3, Number(m.lanes) || 8));
  m.maxOnScreen = Math.min(60, Math.max(4, Number(m.maxOnScreen) || 18));
  m.speed = Math.min(260, Math.max(20, Number(m.speed) || 70));
  m.pauseSeconds = Math.min(30, Math.max(1, Number(m.pauseSeconds) || 5));
  return m;
}

/**
 * 页面背景配置
 *
 * 结构：
 *   {
 *     global: { image, overlay, blur, fixed },       全站默认
 *     pages: {                                       按页面覆盖
 *       home:      {...},
 *       post:      {...},    // 文章详情
 *       archive:   {...},
 *       tags:      {...},
 *       chat:      {...},
 *       guestbook: {...},
 *       profile:   {...},
 *       auth:      {...},    // 登录注册
 *       page:<slug>: {...}   // 独立页面，按 slug 区分
 *     }
 *   }
 *
 * image 支持：
 *   - http(s) URL
 *   - /uploads/xxx 本地图片
 *   - 空字符串表示无背景图
 */
function normalizeBgItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const image = typeof raw.image === 'string' ? raw.image.trim().slice(0, 600) : '';
  // 只允许 http(s)、站内路径、data:image
  const safe = image && (/^https?:\/\//i.test(image) || image.startsWith('/') || /^data:image\//i.test(image));
  const overlay = Number(raw.overlay);
  return {
    // auto: 使用 UAPI 每日壁纸（与 image 二选一，auto 优先）
    auto: !!raw.auto,
    image: safe ? image : '',
    // 遮罩浓度 0-1，越大越暗，保证文字可读
    overlay: Number.isFinite(overlay) ? Math.min(1, Math.max(0, overlay)) : 0.55,
    // 模糊 0-30px
    blur: Math.min(30, Math.max(0, Number(raw.blur) || 0)),
    // 是否固定（视差感）
    fixed: raw.fixed !== false,
    // 背景定位
    position: ['top', 'center', 'bottom'].includes(raw.position) ? raw.position : 'center',
  };
}

function normalizeBackgrounds(stored) {
  const empty = { global: null, pages: {} };
  if (!stored || typeof stored !== 'object') return empty;

  let global = normalizeBgItem(stored.global);
  // 既没图也没开自动壁纸 → 视为未配置
  if (global && !global.image && !global.auto) global = null;
  const pages = {};
  if (stored.pages && typeof stored.pages === 'object') {
    for (const [key, val] of Object.entries(stored.pages)) {
      // 只接受简单键名，避免注入
      if (!/^[a-z0-9_-]{1,60}$/i.test(key)) continue;
      const item = normalizeBgItem(val);
      if (item && (item.image || item.auto)) pages[key] = item;
    }
  }
  return { global, pages };
}

module.exports = router;
