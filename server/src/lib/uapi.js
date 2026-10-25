'use strict';

/**
 * UApiPro（uapis.cn）客户端
 *
 * - Token 只存在服务端（settings.uapi.token 或环境变量），绝不下发到前端
 * - 统一错误处理、超时、结果缓存，避免打满免费额度
 * - 所有请求走 /api/v1/* 的 REST 端点
 */

const db = require('../db');

const BASE = 'https://uapis.cn';
const TIMEOUT_MS = 8000;

/** 简单内存缓存：同一请求短时间内复用 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expire < Date.now()) { cache.delete(key); return undefined; }
  return hit.value;
}

function cacheSet(key, value, ttl = CACHE_TTL) {
  cache.set(key, { value, expire: Date.now() + ttl });
  if (cache.size > 300) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expire < now) cache.delete(k);
  }
}

/** 读取 UAPI 配置（数据库优先，其次环境变量/配置文件） */
async function getConfig() {
  const row = await db
    .one("SELECT value_json FROM settings WHERE key_name = 'uapi' LIMIT 1")
    .catch(() => null);
  const stored = row
    ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json)
    : {};

  const token = stored.token || process.env.PBLOG_UAPI_TOKEN || '';

  return {
    enabled: stored.enabled !== undefined ? !!stored.enabled : !!token,
    token,
    // 首页一句话 / 每日壁纸 / 热榜 / 天气 等模块开关
    features: {
      saying: stored.features?.saying !== false,
      bingWallpaper: stored.features?.bingWallpaper !== false,
      hotboard: stored.features?.hotboard === true,   // 默认关，避免首页太杂
      weather: stored.features?.weather === true,
    },
    hotboardType: stored.hotboardType || 'zhihu',
    city: stored.city || '北京',
  };
}

/** 保存配置 */
async function saveConfig(next) {
  await db.query(
    `INSERT INTO settings (key_name, value_json) VALUES ('uapi', ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [JSON.stringify(next)]
  );
  cache.clear();
}

/**
 * 调用 UAPI 接口
 * @param {string} path   如 '/api/v1/saying'
 * @param {object} query  查询参数
 * @param {object} opts   { useCache, ttl }
 */
async function call(path, query = {}, opts = {}) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error('UAPI token 未配置');

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;

  const cacheKey = `uapi:${url}`;
  if (opts.useCache !== false) {
    const hit = cacheGet(cacheKey);
    if (hit !== undefined) return hit;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json',
        'User-Agent': 'PBLOG/1.0',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`UAPI ${res.status}: ${text.slice(0, 120)}`);
    }

    const data = await res.json();
    if (opts.useCache !== false) cacheSet(cacheKey, data, opts.ttl);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 业务封装 ---------------- */

/** 一言：随机一句 */
async function getSaying() {
  const d = await call('/api/v1/saying', {}, { ttl: 60 * 1000 });
  return { text: d?.text || '' };
}

/** 必应每日壁纸（含标题、描述、版权） */
async function getBingDaily(opts = {}) {
  const d = await call('/api/v1/image/bing-daily', {
    format: 'json',
    resolution: opts.resolution || '1080',
    ...(opts.random ? { random: 'true' } : {}),
  }, { ttl: 30 * 60 * 1000 });
  return {
    title: d?.title || '',
    subtitle: d?.subtitle || d?.headline || '',
    copyright: d?.copyright || '',
    date: d?.date || '',
    // 优先 1080，减小体积
    url: d?.image_url_1080 || d?.image_url || '',
    url4k: d?.image_url_4k || '',
  };
}

/** 全网热榜 */
async function getHotboard(type) {
  const d = await call('/api/v1/misc/hotboard', { type }, { ttl: 3 * 60 * 1000 });
  const list = Array.isArray(d?.list) ? d.list : [];
  return {
    type: d?.type || type,
    updateTime: d?.update_time || '',
    items: list.slice(0, 20).map((it) => ({
      index: it.index ?? it.rank,
      title: it.title || '',
      url: it.url || '',
      hot: it.hot ?? it.hot_value ?? null,
    })),
  };
}

/** 天气 */
async function getWeather(city) {
  const d = await call('/api/v1/misc/weather', { city }, { ttl: 20 * 60 * 1000 });
  return {
    city: d?.city || city,
    province: d?.province || '',
    weather: d?.weather || '',
    temperature: d?.temperature ?? null,
    wind: [d?.wind_direction, d?.wind_power].filter(Boolean).join(' '),
    humidity: d?.humidity ?? null,
    reportTime: d?.report_time || '',
  };
}

module.exports = { getConfig, saveConfig, call, getSaying, getBingDaily, getHotboard, getWeather };
