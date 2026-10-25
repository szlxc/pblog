'use strict';

/**
 * 邮件发送（SMTP）
 * - 配置存 settings 表（key = 'mail'），可在管理后台随时修改，无需重启
 * - 未安装 nodemailer 或未配置时，退化为「控制台打印」，不阻断注册流程
 */
const db = require('../db');
const { load } = require('../../../config');

let cachedTransport = null;
let cachedConfigKey = null;

/** 读取邮件配置：数据库优先，其次 PBLOG.json */
async function getMailConfig() {
  const row = await db.one("SELECT value_json FROM settings WHERE key_name = 'mail' LIMIT 1").catch(() => null);
  const stored = row ? (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json) : {};
  const fallback = load().mail || {};
  return {
    enabled: stored.enabled !== undefined ? !!stored.enabled : !!fallback.enabled,
    host: stored.host || fallback.host || '',
    port: Number(stored.port || fallback.port || 465),
    secure: stored.secure !== undefined ? !!stored.secure : (fallback.secure !== undefined ? !!fallback.secure : true),
    user: stored.user || fallback.user || '',
    pass: stored.pass || fallback.pass || '',
    fromName: stored.fromName || fallback.fromName || '折光日志',
    fromEmail: stored.fromEmail || fallback.fromEmail || stored.user || fallback.user || '',
    requireVerify: stored.requireVerify !== undefined ? !!stored.requireVerify : true,
  };
}

/** 是否具备真正发信能力 */
function canSend(cfg) {
  return !!(cfg.enabled && cfg.host && cfg.user && cfg.pass);
}

/** 获取 nodemailer transport（同一配置复用） */
function getTransport(cfg) {
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}`;
  if (cachedTransport && cachedConfigKey === key) return cachedTransport;

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    return null;
  }
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  cachedConfigKey = key;
  return cachedTransport;
}

/** 清缓存（改了配置后调用） */
function resetTransport() {
  cachedTransport = null;
  cachedConfigKey = null;
}

/**
 * 发送邮件
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function sendMail({ to, subject, html, text }) {
  const cfg = await getMailConfig();
  if (!canSend(cfg)) {
    console.log(`[mail] 未配置 SMTP，模拟发送 -> ${to} | ${subject}`);
    if (text) console.log(`[mail] 正文: ${text.slice(0, 200)}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const transport = getTransport(cfg);
  if (!transport) {
    console.log(`[mail] 未安装 nodemailer，跳过真实发送 -> ${to} | ${subject}`);
    return { sent: false, reason: 'nodemailer_missing' };
  }
  try {
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail || cfg.user}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    return { sent: true };
  } catch (e) {
    console.error('[mail] 发送失败:', e.message);
    return { sent: false, reason: e.message };
  }
}

/** 测试连接 */
async function verifyConnection() {
  const cfg = await getMailConfig();
  if (!canSend(cfg)) return { ok: false, message: 'SMTP 未启用或配置不完整' };
  const transport = getTransport(cfg);
  if (!transport) return { ok: false, message: '服务端未安装 nodemailer（npm i nodemailer）' };
  try {
    await transport.verify();
    return { ok: true, message: 'SMTP 连接正常' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

module.exports = { getMailConfig, canSend, sendMail, verifyConnection, resetTransport };
