'use strict';

/**
 * 数据库连接池
 */
const mysql = require('mysql2/promise');
const { dbConfig } = require('../../../config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig());
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** 取多行 */
async function all(sql, params) {
  return query(sql, params);
}

/** 取一行 */
async function one(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** 取单值 */
async function scalar(sql, params) {
  const row = await one(sql, params);
  if (!row) return null;
  return Object.values(row)[0];
}

/** 事务封装 */
async function tx(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, all, one, scalar, tx, close };
