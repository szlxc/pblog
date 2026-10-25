'use strict';

const crypto = require('crypto');

/**
 * 生成 URL slug。
 * 中文标题先用拼音表简化会太重，这里采取：保留 ASCII，中文保留（URI 编码后作为 slug）
 * 也可以传入自定义 slug（管理端可手填）。
 */
function makeSlug(input, fallbackPrefix = 'post') {
  const s = String(input || '').trim().toLowerCase();
  let slug = s
    .replace(/['"’”“]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) slug = `${fallbackPrefix}-${Date.now().toString(36)}`;
  // 限制长度（按字符）
  return Array.from(slug).slice(0, 100).join('');
}

/** 估算中文/英文混排字数 */
function countWords(text) {
  const plain = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~\-]/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length;
  const words = (plain.match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + words;
}

/** 阅读时长（分钟），中文按 350 字/分钟，英文按 200 词/分钟近似合并计算 */
function readingTime(text) {
  const words = countWords(text);
  return Math.max(1, Math.round(words / 300));
}

/** 从正文提取摘要 */
function extractSummary(content, maxLen = 160) {
  const plain = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + '…' : plain;
}

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** 简单内存缓存 */
class MemCache {
  constructor(defaultTtlMs = 60000) {
    this.map = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expire < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    this.map.set(key, { value, expire: Date.now() + ttlMs });
    if (this.map.size > 500) {
      // 简单淘汰
      const now = Date.now();
      for (const [k, v] of this.map) if (v.expire < now) this.map.delete(k);
    }
    return value;
  }
  clear(prefix) {
    if (!prefix) return this.map.clear();
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k);
  }
}

/** HTML 转义 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = { makeSlug, countWords, readingTime, extractSummary, sha256, randomToken, MemCache, escapeHtml };
