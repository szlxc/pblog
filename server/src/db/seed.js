'use strict';

/**
 * 种子数据：管理员账号、示例分类/标签/文章/页面/友链
 * 用法: node src/db/seed.js [--force]
 * 幂等：管理员已存在则跳过；文章仅在 posts 表为空时写入（--force 强制重写示例内容）
 */
const bcrypt = require('bcryptjs');
const db = require('./index');
const { load } = require('../../../config');
const { makeSlug, countWords, readingTime } = require('../lib/text');

const SAMPLE_POSTS = [
  {
    title: '把复杂拆开：我的三层笔记法',
    category: '方法',
    tags: ['知识管理', '工作流'],
    pinned: true,
    summary: '信息不是知识。记录、连接、输出，三层结构让笔记真正变成能复用的东西。',
    content: `## 为什么记了很多却没变强

笔记的真正价值不在于「存下来」，而在于**能不能在需要的时候被找到并被组合**。多数人的笔记死在第一步：只做了采集，没有做连接。

### 三层结构

| 层级 | 内容 | 载体 | 更新频率 |
| --- | --- | --- | --- |
| 收集层 | 原始素材、摘录、链接 | 快速输入 | 每天 |
| 连接层 | 卡片、概念、关联 | 双向链接 | 每周 |
| 输出层 | 文章、方案、复盘 | 公开或内部 | 每月 |

> 收集是廉价的，连接才是昂贵的。把时间花在后者。

### 卡片的三条硬规则

1. 一张卡片只讲一个想法
2. 标题必须是一句完整的话，而不是名词
3. 写完必须至少连到另一张卡片

\`\`\`js
// 用代码管理元数据也是可行的
const card = {
  title: '连接比收集更重要',
  links: ['#卡片写作', '#知识管理'],
  updated: new Date().toISOString(),
};
\`\`\`

最后一点经验：**每周留出两小时专门做连接**，不做采集。这可能是整套方法里唯一不能省的一步。`,
  },
  {
    title: '从零搭一个自托管博客：为什么我又回来了',
    category: '工程',
    tags: ['自托管', '后端'],
    summary: '托管平台很方便，但数据、样式、域名都握在自己手里，才是我想要的长期形态。',
    content: `## 第三次折腾

这是我第三次自己搭博客。前两次分别死在了「样式调太细」和「部署太麻烦」上。这次我把目标改小：**先让它稳定跑一年，再谈好看**。

### 这次的关键决定

- 数据库用 MySQL，不用 SQLite：多进程部署不用操心文件锁
- 前端与后端完全分离，静态资源交给 CDN 或 Nginx
- 所有配置集中在**一个 JSON 文件**里，前端和管理端构建时注入

### 部署草图

\`\`\`bash
# 一条命令拉起全部服务
docker compose up -d --build
\`\`\`

\`\`\`yaml
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: pblog
      MYSQL_USER: pblog
      MYSQL_PASSWORD: \${PBLOG_DB_PASSWORD}
\`\`\`

稳定比花哨重要得多。先把「能持续更新」这件事解决，再谈设计。`,
  },
  {
    title: '写代码十年，我留下的七条习惯',
    category: '工程',
    tags: ['工程实践', '复盘'],
    summary: '不是什么高深技巧，都是能每天用上的小习惯，但积累十年的复利很可观。',
    content: `### 1. 先写最坏情况的测试

不要从 happy path 开始。先问：什么输入会让它崩？

### 2. 函数名用动词，变量名用名词

### 3. 提交信息写「为什么」，不是「做了什么」

\`\`\`text
fix: 避免在事务里做外部请求
原因：网络抖动会导致连接被长时间占用，压测时打满连接池
\`\`\`

### 4. 每个 PR 小于 400 行

### 5. 上线前把回滚方案写下来

### 6. 监控先于功能

### 7. 每周读一次别人的代码

最后一条最难坚持，但收益最大。`,
  },
  {
    title: '用 CSS 变量做一个可换肤的界面',
    category: '前端',
    tags: ['CSS', '设计系统'],
    summary: '主题切换不需要两套样式表。把颜色、圆角、字体全部变成变量，一行 data-theme 就能换肤。',
    content: `## 变量先行

\`\`\`css
:root {
  --accent: #6ee7b7;
  --radius: 16px;
  --surface: rgba(255, 255, 255, 0.04);
}
[data-theme='light'] {
  --surface: rgba(0, 0, 0, 0.03);
}
\`\`\`

### 让用户自己选

把选择存进 \`localStorage\`，首屏在 \`<head>\` 里同步读取，避免闪烁。

\`\`\`js
const saved = localStorage.getItem('theme');
if (saved) document.documentElement.dataset.theme = saved;
\`\`\`

**关键点**：所有颜色只走变量，不要在组件里写死色值。否则换肤永远做不干净。`,
  },
  {
    title: '摄影笔记：只用一支定焦镜头的三个月',
    category: '随笔',
    tags: ['摄影', '随笔'],
    summary: '放弃变焦之后，我开始用脚移动。限制反而让观察变得锋利。',
    content: `三个月，只带 35mm。

- 第一个月：难受，总觉得「不够广」「不够长」
- 第二个月：开始预判距离，身体形成肌肉记忆
- 第三个月：能在举起相机之前就知道画面什么样

> 器材的限制不是缺点，是让你专注的借口。

这三个月拍的照片不多，但废片率明显降低。**放弃覆盖所有可能，才可能拍好眼前这一张。**`,
  },
  {
    title: 'MySQL 索引没生效的五个常见原因',
    category: '工程',
    tags: ['MySQL', '性能'],
    summary: 'EXPLAIN 里出现 type=ALL 的时候，先别急着加索引，看看这五种情况。',
    content: `### 1. 隐式类型转换

\`user_id\` 是 varchar，你传了数字，索引直接失效。

### 2. 函数包住索引列

\`\`\`sql
-- 慢
SELECT * FROM posts WHERE DATE(created_at) = '2026-01-01';
-- 快
SELECT * FROM posts WHERE created_at >= '2026-01-01' AND created_at < '2026-01-02';
\`\`\`

### 3. 最左前缀不满足

复合索引 \`(a, b, c)\`，只查 b 和 c 用不上。

### 4. LIKE 以通配符开头

\`LIKE '%关键字%'\` 无法走 B+Tree，考虑全文索引。

### 5. 选择性太差

性别字段建索引没有意义，优化器会算出来然后放弃。

排查顺序：**EXPLAIN → 看 type 与 key → 看 rows 估算 → 再决定加不加索引**。`,
  },
  {
    title: '如何写好一份技术文档',
    category: '方法',
    tags: ['写作', '文档'],
    summary: '文档的读者不是未来的自己，而是三个月后接手这块代码的陌生人。',
    content: `## 三个问题决定文档质量

1. 读者是谁？（完全不了解这个系统的人，还是同组同事？）
2. 他读完想做什么？（跑起来 / 改功能 / 排错）
3. 他会在什么场景下读？（凌晨两点被叫起来修 bug 时读的，和白天规划新功能时读的，完全是两种文档）

### 结构模板

- **一句话说明这是什么**
- 快速开始（不超过 5 条命令）
- 架构图或数据流
- 常见问题
- 变更记录

> 不要让读者在文档里做考古。**每一段都应该能独立回答一个问题。**`,
  },
];

async function main() {
  const force = process.argv.includes('--force');
  const cfg = load();

  // 1. 管理员
  const existing = await db.one('SELECT id FROM users WHERE username = ?', [cfg.adminDefaults.username]);
  let adminId;
  if (existing) {
    adminId = existing.id;
    console.log(`[seed] 管理员 ${cfg.adminDefaults.username} 已存在，跳过`);
  } else {
    const hash = await bcrypt.hash(cfg.adminDefaults.password, 10);
    const r = await db.query(
      'INSERT INTO users (username, password_hash, email, display_name, role) VALUES (?,?,?,?,?)',
      [cfg.adminDefaults.username, hash, cfg.adminDefaults.email, cfg.adminDefaults.displayName, 'admin']
    );
    adminId = r.insertId;
    console.log(`[seed] 已创建管理员: ${cfg.adminDefaults.username} / ${cfg.adminDefaults.password}（请尽快修改密码）`);
  }

  // 2. 分类
  const catDefs = [
    { name: '工程', desc: '代码、架构与踩坑记录', color: '#6ee7b7' },
    { name: '前端', desc: '界面与交互', color: '#818cf8' },
    { name: '方法', desc: '工作流与思考方式', color: '#fbbf24' },
    { name: '随笔', desc: '生活与观察', color: '#fb7185' },
  ];
  const catMap = {};
  for (const [i, c] of catDefs.entries()) {
    const slug = makeSlug(c.name, 'cat');
    const row = await db.one('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (row) { catMap[c.name] = row.id; continue; }
    const r = await db.query(
      'INSERT INTO categories (name, slug, description, color, sort_order) VALUES (?,?,?,?,?)',
      [c.name, slug, c.desc, c.color, i]
    );
    catMap[c.name] = r.insertId;
  }
  console.log(`[seed] 分类 ${Object.keys(catMap).length} 个`);

  // 3. 文章
  const postCount = await db.scalar('SELECT COUNT(*) FROM posts');
  if (postCount > 0 && !force) {
    console.log(`[seed] posts 表已有 ${postCount} 条数据，跳过示例文章（--force 可覆盖）`);
  } else {
    for (const [i, p] of SAMPLE_POSTS.entries()) {
      const slug = makeSlug(p.title, 'post');
      const exists = await db.one('SELECT id FROM posts WHERE slug = ?', [slug]);
      if (exists && !force) continue;
      const publishedAt = new Date(Date.now() - (SAMPLE_POSTS.length - i) * 3 * 864e5);
      const words = countWords(p.content);
      const postId = await db.tx(async (conn) => {
        if (exists) {
          await conn.execute('UPDATE posts SET title=?, summary=?, content=?, word_count=?, reading_time=? WHERE id=?',
            [p.title, p.summary, p.content, words, readingTime(p.content), exists.id]);
          await conn.execute('DELETE FROM post_tags WHERE post_id=?', [exists.id]);
          return exists.id;
        }
        const [r] = await conn.execute(
          `INSERT INTO posts (title, slug, summary, content, content_format, author_id, category_id, status,
            is_pinned, is_featured, word_count, reading_time, view_count, like_count, published_at)
           VALUES (?,?,?,?,'markdown',?,?,'published',?,?,?,?,?,?,?)`,
          [p.title, slug, p.summary, p.content, adminId, catMap[p.category] || null,
            p.pinned ? 1 : 0, i < 3 ? 1 : 0, words, readingTime(p.content),
            Math.floor(Math.random() * 400) + 60, Math.floor(Math.random() * 40), publishedAt]
        );
        return r.insertId;
      });
      for (const tagName of p.tags) {
        const tSlug = makeSlug(tagName, 'tag');
        let tag = await db.one('SELECT id FROM tags WHERE slug = ?', [tSlug]);
        if (!tag) {
          const r = await db.query('INSERT INTO tags (name, slug) VALUES (?,?)', [tagName, tSlug]);
          tag = { id: r.insertId };
        }
        await db.query('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)', [postId, tag.id]);
      }
    }
    console.log('[seed] 示例文章已写入');
  }

  // 4. 独立页面
  const pages = [
    {
      title: '关于', slug: 'about', showInNav: 1,
      content: `## 你好，我是${cfg.sites.frontend.author}

${cfg.sites.frontend.authorBio}

### 我在写什么

这里主要记录三类内容：工程实践中的取舍、前端与设计的实现细节、以及对长期主义的一些观察。

### 联系方式

- 邮箱：hi@example.com
- GitHub：https://github.com/

> 如果某篇文章对你有帮助，欢迎在评论区告诉我。`,
    },
    {
      title: '友链', slug: 'links', showInNav: 1,
      content: `这里是一些我常读的站点。交换友链请通过「关于」页的邮箱联系我。`,
    },
  ];
  for (const pg of pages) {
    const exists = await db.one('SELECT id FROM pages WHERE slug=?', [pg.slug]);
    if (exists) continue;
    await db.query(
      'INSERT INTO pages (title, slug, content, content_format, status, show_in_nav, sort_order) VALUES (?,?,?,?,?,?,?)',
      [pg.title, pg.slug, pg.content, 'markdown', 'published', pg.showInNav ? 1 : 0, 0]
    );
  }
  console.log('[seed] 独立页面已就绪');

  // 5. 友链
  const linkCount = await db.scalar('SELECT COUNT(*) FROM links');
  if (linkCount === 0) {
    await db.query(
      `INSERT INTO links (name, url, description, avatar, sort_order) VALUES
       (?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?)`,
      [
        '阮一峰的网络日志', 'https://www.ruanyifeng.com/blog/', '科技爱好者周刊', null, 0,
        'CSS-Tricks', 'https://css-tricks.com/', '前端技术文章', null, 1,
        'Julia Evans', 'https://jvns.ca/', '系统与调试笔记', null, 2,
      ]
    );
    console.log('[seed] 友链已写入');
  }

  // 6. 不再生成虚假流量数据
  //    早期版本为了「让仪表盘图表不空」会插入随机 page_views，
  //    这会让统计失去意义（数字看起来是假的）。现已移除。
  //    如果库里还残留 demo 数据，可执行 npm run clean-demo 清除。

  await db.close();
  console.log('[seed] 完成');
}

main().catch((e) => { console.error('[seed] 失败:', e); process.exit(1); });
