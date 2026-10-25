'use strict';

/**
 * PBLOG 后端入口
 * 启动：node src/index.js
 */
const { load } = require('../../config');
const { createApp } = require('./app');
const db = require('./db');

async function main() {
  const cfg = load();
  const app = createApp();

  // 启动前探测数据库（失败不致命，便于先起服务再建库）
  try {
    await db.scalar('SELECT 1');
    console.log(`[pblog] 数据库已连接: ${cfg.database.user}@${cfg.database.host}:${cfg.database.port}/${cfg.database.database}`);
  } catch (e) {
    console.warn('[pblog] 数据库连接失败，接口将返回错误:', e.message);
  }

  const server = app.listen(cfg.backend.port, cfg.backend.host, () => {
    console.log(`[pblog] 服务已启动 http://${cfg.backend.host}:${cfg.backend.port}`);
    console.log(`[pblog] 对外地址 ${cfg.backend.publicUrl}`);
    console.log(`[pblog] 允许来源 ${JSON.stringify(cfg.backend.cors)}`);
  });

  server.headersTimeout = 35000;
  server.requestTimeout = cfg.backend.requestTimeoutMs || 30000;

  const shutdown = async (sig) => {
    console.log(`\n[pblog] 收到 ${sig}，正在关闭...`);
    server.close(async () => {
      await db.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error('[pblog] 启动失败:', e);
  process.exit(1);
});
