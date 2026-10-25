'use strict';

/**
 * 数据库迁移：创建库（若不存在）+ 建表 + 增量升级
 * 用法: node src/db/migrate.js
 *
 * 幂等设计：
 *   - 建表用 CREATE TABLE IF NOT EXISTS
 *   - 加列/改枚举前先查 information_schema，已存在则跳过
 * 因此可以反复执行，对已有数据无影响。
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { dbConfig, load } = require('../../../config');

/** 检查某列是否存在 */
async function hasColumn(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column]
  );
  return rows[0].n > 0;
}

/** 检查某表是否存在 */
async function hasTable(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [db, table]
  );
  return rows[0].n > 0;
}

async function main() {
  const cfg = dbConfig();
  console.log(`[migrate] 目标: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

  // 1. 先用无 database 的连接建库
  const root = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    charset: cfg.charset, multipleStatements: true,
  });
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();
  console.log(`[migrate] 数据库存在或已创建: ${cfg.database}`);

  // 2. 建表（IF NOT EXISTS，已有表不受影响）
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
  await conn.query(schema);
  console.log('[migrate] 表结构已就绪');

  // 3. 增量升级：为已存在的 users 表补新列
  const db = cfg.database;
  if (await hasTable(conn, db, 'users')) {
    if (!(await hasColumn(conn, db, 'users', 'email_verified_at'))) {
      await conn.query('ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME DEFAULT NULL AFTER `role`');
      console.log('[migrate] + users.email_verified_at');
    }
    if (!(await hasColumn(conn, db, 'users', 'status'))) {
      await conn.query("ALTER TABLE `users` ADD COLUMN `status` ENUM('active','banned') NOT NULL DEFAULT 'active' AFTER `email_verified_at`");
      console.log('[migrate] + users.status');
    }
    if (!(await hasColumn(conn, db, 'users', 'preferences'))) {
      await conn.query('ALTER TABLE `users` ADD COLUMN `preferences` JSON DEFAULT NULL AFTER `status`');
      console.log('[migrate] + users.preferences（个人主题偏好）');
    }
    // 角色枚举扩展（先查当前定义，不含 member 才改）
    const [col] = await conn.query(
      `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`, [db]
    );
    if (col.length && !String(col[0].t).includes('member')) {
      await conn.query("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin','editor','member') NOT NULL DEFAULT 'member'");
      // 已有账号若角色为空或未知，视为管理员（避免把现有管理员降级）
      await conn.query("UPDATE `users` SET `role` = 'admin' WHERE `role` IS NULL OR `role` = ''");
      console.log('[migrate] ~ users.role 已支持 member');
    }
  }

  await conn.end();

  const s = load();
  console.log(`[migrate] 站点「${s.sites.frontend.title}」配置已加载`);
  console.log('[migrate] 完成，可执行: npm run seed');
}

main().catch((e) => { console.error('[migrate] 失败:', e.message); process.exit(1); });
