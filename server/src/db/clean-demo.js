'use strict';

/**
 * 清理早期 seed 生成的「演示流量」假数据
 * 用法: node src/db/clean-demo.js
 *
 * 判定依据：
 *   visitor_key 以 'demo-' 开头（真实访客是 hash 后的 32 位十六进制）
 *   path = '/post/demo'
 */
const db = require('./index');

async function main() {
  const cond = "path = '/post/demo' OR visitor_key LIKE 'demo-%'";

  const before = await db.scalar(`SELECT COUNT(*) FROM page_views WHERE ${cond}`);
  const total = await db.scalar('SELECT COUNT(*) FROM page_views');
  console.log(`[clean] 总浏览记录 ${total} 条，其中演示数据 ${before} 条`);

  if (!before) {
    console.log('[clean] 没有需要清理的演示数据');
    await db.close();
    return;
  }

  await db.query(`DELETE FROM page_views WHERE ${cond}`);

  // 同步修正文章阅读数：扣掉演示数据造成的虚高
  // 以真实记录数为准重算
  await db.query(`
    UPDATE posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS real_views
        FROM page_views WHERE post_id IS NOT NULL GROUP BY post_id
    ) v ON v.post_id = p.id
    SET p.view_count = COALESCE(v.real_views, 0)
  `);

  const after = await db.scalar('SELECT COUNT(*) FROM page_views');
  console.log(`[clean] 已删除 ${before} 条演示数据，剩余 ${after} 条真实记录`);
  console.log('[clean] 已按真实记录重算各文章的 view_count');
  await db.close();
}

main().catch((e) => {
  console.error('[clean] 失败:', e.message);
  process.exit(1);
});
