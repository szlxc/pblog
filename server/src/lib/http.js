'use strict';

/** 统一 API 响应格式 */
class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
  static badRequest(msg = '请求参数有误', details) { return new ApiError(400, msg, 'bad_request', details); }
  static unauthorized(msg = '未登录或登录已过期') { return new ApiError(401, msg, 'unauthorized'); }
  static forbidden(msg = '没有权限') { return new ApiError(403, msg, 'forbidden'); }
  static notFound(msg = '资源不存在') { return new ApiError(404, msg, 'not_found'); }
  static conflict(msg = '资源冲突') { return new ApiError(409, msg, 'conflict'); }
  static tooMany(msg = '请求过于频繁，请稍后再试') { return new ApiError(429, msg, 'rate_limited'); }
  static internal(msg = '服务器内部错误') { return new ApiError(500, msg, 'internal_error'); }
}

function ok(res, data = null, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

function created(res, data) {
  return res.status(201).json({ ok: true, data });
}

/** 包装 async 路由，自动把异常交给错误中间件 */
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** 分页参数解析 */
function parsePaging(query, defaultSize = 10, maxSize = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function pagingMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNext: page * pageSize < total,
    hasPrev: page > 1,
  };
}

module.exports = { ApiError, ok, created, wrap, parsePaging, pagingMeta };
