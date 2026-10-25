'use strict';

/**
 * UAPI 集成（前台展示 + 后台配置）
 *
 * 前台：
 *   GET /api/uapi/saying     一言
 *   GET /api/uapi/wallpaper  必应每日壁纸
 *   GET /api/uapi/hotboard   热榜
 *   GET /api/uapi/weather    天气
 *
 * 后台：
 *   GET /api/admin/uapi-config
 *   PUT /api/admin/uapi-config
 *   POST /api/admin/uapi-test
 */
const express = require('express');
const uapi = require('../lib/uapi');
const { wrap, ok, ApiError } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');

const pub = express.Router();
const admin = express.Router();

/* ================= 前台 ================= */

pub.get('/saying', wrap(async (req, res) => {
  const cfg = await uapi.getConfig();
  if (!cfg.enabled || !cfg.features.saying) return ok(res, { text: '' });
  try {
    ok(res, await uapi.getSaying());
  } catch (e) {
    // UAPI 挂了不能影响博客，静默降级
    ok(res, { text: '', error: true });
  }
}));

pub.get('/wallpaper', wrap(async (req, res) => {
  const cfg = await uapi.getConfig();
  if (!cfg.enabled || !cfg.features.bingWallpaper) return ok(res, null);
  try {
    ok(res, await uapi.getBingDaily({ resolution: req.query.resolution }));
  } catch (e) {
    ok(res, null);
  }
}));

pub.get('/hotboard', wrap(async (req, res) => {
  const cfg = await uapi.getConfig();
  if (!cfg.enabled || !cfg.features.hotboard) return ok(res, null);
  const type = String(req.query.type || cfg.hotboardType);
  if (!/^[a-z0-9-]{2,32}$/i.test(type)) throw ApiError.badRequest('无效的平台类型');
  try {
    ok(res, await uapi.getHotboard(type));
  } catch (e) {
    ok(res, null);
  }
}));

pub.get('/weather', wrap(async (req, res) => {
  const cfg = await uapi.getConfig();
  if (!cfg.enabled || !cfg.features.weather) return ok(res, null);
  const city = String(req.query.city || cfg.city || '北京').slice(0, 32);
  try {
    ok(res, await uapi.getWeather(city));
  } catch (e) {
    ok(res, null);
  }
}));

/* ================= 后台配置 ================= */

admin.get('/uapi-config', wrap(async (req, res) => {
  const cfg = await uapi.getConfig();
  ok(res, {
    enabled: cfg.enabled,
    // 绝不返回完整 token
    tokenMasked: cfg.token ? `${cfg.token.slice(0, 9)}…${cfg.token.slice(-4)}` : '',
    hasToken: !!cfg.token,
    features: cfg.features,
    hotboardType: cfg.hotboardType,
    city: cfg.city,
  });
}));

admin.put('/uapi-config', wrap(async (req, res) => {
  const b = req.body || {};
  const cur = await uapi.getConfig();

  // 传 **** 或留空表示不修改 token
  let token = cur.token;
  if (typeof b.token === 'string' && b.token.trim() && !b.token.includes('…')) {
    token = b.token.trim();
  }

  await uapi.saveConfig({
    enabled: b.enabled !== undefined ? !!b.enabled : cur.enabled,
    token,
    features: {
      saying: b.features?.saying !== undefined ? !!b.features.saying : cur.features.saying,
      bingWallpaper: b.features?.bingWallpaper !== undefined ? !!b.features.bingWallpaper : cur.features.bingWallpaper,
      hotboard: b.features?.hotboard !== undefined ? !!b.features.hotboard : cur.features.hotboard,
      weather: b.features?.weather !== undefined ? !!b.features.weather : cur.features.weather,
    },
    hotboardType: b.hotboardType || cur.hotboardType,
    city: b.city || cur.city,
  });

  ok(res, { updated: true });
}));

admin.post('/uapi-test', wrap(async (req, res) => {
  try {
    const saying = await uapi.getSaying();
    const wall = await uapi.getBingDaily().catch(() => null);
    ok(res, {
      ok: true,
      saying: saying.text,
      wallpaper: wall?.title || '',
    });
  } catch (e) {
    ok(res, { ok: false, message: e.message });
  }
}));

module.exports = { public: pub, admin };
