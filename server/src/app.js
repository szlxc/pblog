'use strict';

/**
 * Express 应用装配
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { load, normalizeOrigins } = require('../../config');
const { ApiError } = require('./lib/http');
const { errorHandler, notFound, rateLimit, requestId } = require('./middleware');

function createApp() {
  const cfg = load();
  const app = express();

  if (cfg.backend.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // API 服务，前端另配
  }));
  app.use(compression());

  // 裁掉路径，只比对协议+主机+端口（浏览器 Origin 头不含路径）
  const origins = normalizeOrigins(cfg.backend.cors);
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // 同源/服务器调用
      if (origins.includes('*') || origins.includes(origin)) return cb(null, true);
      return cb(ApiError.forbidden(`来源不被允许: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // 静态：上传的图片
  const uploadDir = path.resolve(cfg.backend.upload.dir);
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir, {
    maxAge: '30d',
    setHeaders(res) { res.setHeader('Cache-Control', 'public, max-age=2592000'); },
  }));

  // 健康检查
  app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime(), ts: Date.now() }));

  // 配置自检（不暴露敏感信息）
  app.get('/api/config', (req, res) => {
    res.json({
      ok: true,
      data: {
        publicUrl: cfg.backend.publicUrl,
        cors: normalizeOrigins(cfg.backend.cors),
        features: cfg.features,
        serverTime: new Date().toISOString(),
      },
    });
  });

  app.use('/api', rateLimit());
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/member', require('./routes/member'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/guestbook', require('./routes/guestbook'));
  const uapiRoutes = require('./routes/uapi');
  app.use('/api/uapi', uapiRoutes.public);
  app.use('/api/admin/posts', require('./routes/admin-posts'));
  app.use('/api/admin', require('./routes/admin-taxonomy'));
  app.use('/api/admin/comments', require('./routes/admin-comments'));
  app.use('/api/admin/dashboard', require('./routes/admin-dashboard'));
  app.use('/api/admin/upload', require('./routes/admin-upload'));
  app.use('/api/admin', require('./routes/admin-community'));
  app.use('/api/admin', require('./routes/uapi').admin);
  app.use('/api/admin', require('./routes/admin-misc'));
  app.use('/api', require('./routes/public'));

  // 可选：托管前台/管理端静态文件（单容器部署时启用）
  const webDist = process.env.PBLOG_SERVE_WEB_DIR;
  const adminDist = process.env.PBLOG_SERVE_ADMIN_DIR;
  if (webDist && fs.existsSync(webDist)) {
    app.use(express.static(webDist, { maxAge: '1d' }));
  }
  if (adminDist && fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist, { maxAge: '1d' }));
  }
  if (webDist && fs.existsSync(path.join(webDist, 'index.html'))) {
    app.get(/^\/(?!api|uploads|healthz|admin).*/, (req, res) =>
      res.sendFile(path.join(webDist, 'index.html')));
  }
  if (adminDist && fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.get(/^\/admin\/.*/, (req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
