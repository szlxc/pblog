'use strict';

/**
 * 管理端：文件上传
 * POST /api/admin/upload  (multipart/form-data, field=file)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { wrap, created, ApiError } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { load } = require('../../../config');

const router = express.Router();
router.use(requireAdmin);

const cfg = load();
const uploadDir = path.resolve(cfg.backend.upload.dir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10) || '.bin';
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(cfg.backend.upload.maxSizeMB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = cfg.backend.upload.allowedTypes || [];
    if (allowed.length && !allowed.includes(file.mimetype)) {
      return cb(ApiError.badRequest(`不支持的文件类型: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('没有收到文件');
  const publicUrl = String(cfg.backend.publicUrl).replace(/\/$/, '');
  const url = `${publicUrl}/uploads/${req.file.filename}`;

  let width = null;
  let height = null;
  try {
    const sharp = require('sharp');
    const meta = await sharp(req.file.path).metadata();
    width = meta.width || null;
    height = meta.height || null;
  } catch (_) { /* sharp 为可选项 */ }

  const r = await db.query(
    `INSERT INTO media (filename, stored_name, url, mime, size, width, height, uploader_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [req.file.originalname.slice(0, 255), req.file.filename, url, req.file.mimetype,
      req.file.size, width, height, req.user.id]
  );

  created(res, {
    id: r.insertId,
    url,
    filename: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
    width,
    height,
  });
}));

module.exports = router;
