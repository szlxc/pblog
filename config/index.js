/**
 * PBLOG 统一配置加载器
 * ---------------------------------------------------------------
 * 前端(Vite)、管理端(Vite)、后端(Node) 都通过这个模块读取 ../PBLOG.json。
 * - 支持 ${ENV_NAME} 与 ${ENV_NAME:-默认值} 两种环境变量插值
 * - 二进制/无 fs 环境（如 Vite 浏览器侧）只会在构建时被调用，因此安全
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', 'PBLOG.json');

let cached = null;

function interpolate(value) {
  if (typeof value === 'string') {
    // 整串就是一个变量：保持原始类型转换
    const full = value.match(/^\$\{([A-Z0-9_]+)(?::-([^}]*))?\}$/);
    if (full) {
      const [, name, fallback] = full;
      const v = process.env[name];
      if (v !== undefined && v !== '') return coerce(v);
      return fallback !== undefined ? coerce(fallback) : undefined;
    }
    // 内嵌变量
    return value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, name, fallback) => {
      const v = process.env[name];
      if (v !== undefined && v !== '') return v;
      return fallback !== undefined ? fallback : '';
    });
  }
  if (Array.isArray(value)) return value.map(interpolate).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '$comment') continue;
      const r = interpolate(v);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

function coerce(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
  return str;
}

function load(force = false) {
  if (cached && !force) return cached;
  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (e) {
    throw new Error(`[pblog] 找不到统一配置文件: ${CONFIG_PATH}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`[pblog] PBLOG.json 语法错误: ${e.message}`);
  }
  cached = interpolate(parsed);
  return cached;
}

/** 后端使用：数据库连接参数（mysql2 形状） */
function dbConfig() {
  const { database } = load();
  return {
    host: database.host,
    port: Number(database.port),
    user: database.user,
    password: database.password,
    database: database.database,
    charset: database.charset || 'utf8mb4',
    connectionLimit: Number(database.connectionLimit || 10),
    timezone: database.timezone || '+08:00',
    waitForConnections: true,
    queueLimit: 0,
    decimalNumbers: true,
  };
}

/** 前端使用：只暴露公开的部分 */
function publicConfig() {
  const { sites, backend, features } = load();
  return {
    sites,
    backend: {
      publicUrl: backend.publicUrl,
      cors: normalizeOrigins(backend.cors),
      upload: { maxSizeMB: backend.upload.maxSizeMB },
    },
    features,
  };
}

/**
 * CORS 只比对「协议 + 主机 + 端口」，浏览器不会在 Origin 头里带路径。
 * 因此 http://host/admin 这类带路径的配置要裁成 http://host，
 * 否则管理端单独部署时会匹配失败。
 */
function normalizeOrigins(list) {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list
    .filter(Boolean)
    .map((item) => {
      const s = String(item).trim();
      if (s === '*') return s;
      try {
        const u = new URL(s);
        return u.origin;
      } catch (_) {
        return s.replace(/\/+$/, '');
      }
    })
    .filter(Boolean)));
}

module.exports = { load, dbConfig, publicConfig, normalizeOrigins, CONFIG_PATH };
