'use strict';

const { ApiError } = require('../lib/http');
const { load } = require('../../../config');

/** 统一错误处理 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[pblog] 500', req.method, req.originalUrl, err);
  }
  const body = {
    ok: false,
    error: {
      code: err.code || 'internal_error',
      message: status >= 500 ? '服务器内部错误' : err.message,
    },
  };
  if (err.details) body.error.details = err.details;
  res.status(status).json(body);
}

/** 404 */
function notFound(req, res, next) {
  next(ApiError.notFound(`接口不存在: ${req.method} ${req.originalUrl}`));
}

/** 极简内存速率限制（单实例足够；多实例请改用 Redis 或网关层限流） */
function rateLimit() {
  const { features } = load();
  const { windowMs = 60000, max = 120 } = features.rateLimit || {};
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = (req.headers['x-forwarded-for'] || req.ip || 'unknown') + ':' + req.path;
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || rec.reset < now) {
      rec = { count: 0, reset: now + windowMs };
      hits.set(key, rec);
    }
    rec.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rec.count));
    if (rec.count > max) return next(ApiError.tooMany());
    next();
  };
}

/** 请求耗时日志用 */
function requestId(req, res, next) {
  req.id = Math.random().toString(36).slice(2, 10);
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { errorHandler, notFound, rateLimit, requestId };
