/**
 * API 客户端
 * 后端地址来自统一配置 PBLOG.json → backend.publicUrl（构建时注入 window.__PBLOG__）
 *
 * 两套独立身份：
 *   - 访客（member）：token 存 localStorage，用 auth: 'member' 标记
 *   - 管理员不走这个前端
 */
const CONFIG = (typeof window !== 'undefined' && window.__PBLOG__) || { backend: { publicUrl: '' } };
const BASE = (CONFIG.backend?.publicUrl || '').replace(/\/$/, '');

const M_TOKEN = 'pblog.member.access';
const M_REFRESH = 'pblog.member.refresh';

let memberToken = localStorage.getItem(M_TOKEN) || null;

export function setMemberTokens({ accessToken, refreshToken } = {}) {
  memberToken = accessToken || null;
  if (accessToken) localStorage.setItem(M_TOKEN, accessToken);
  else localStorage.removeItem(M_TOKEN);
  // refreshToken 为 undefined 表示「不修改」，为 null 表示「保持不动」（管理员场景）
  if (refreshToken) localStorage.setItem(M_REFRESH, refreshToken);
}

export function clearMemberTokens() {
  memberToken = null;
  localStorage.removeItem(M_TOKEN);
  localStorage.removeItem(M_REFRESH);
}

export function getMemberRefresh() {
  return localStorage.getItem(M_REFRESH);
}

/** 读取管理端登录时留下的 refresh token（同一浏览器共享） */
export function getAdminRefresh() {
  return localStorage.getItem('pblog.admin.refresh');
}

export function getMemberToken() {
  return memberToken;
}

export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const url = `${BASE}/api${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function rawRequest(path, { method = 'GET', body, query, signal, auth = false, headers = {} } = {}) {
  const useMember = auth === 'member';
  const res = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(useMember && memberToken ? { Authorization: `Bearer ${memberToken}` } : {}),
      ...headers,
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch (_) { payload = { raw: text }; } }
  return { res, payload };
}

async function request(path, opts = {}) {
  let { res, payload } = await rawRequest(path, opts);

  // 会员 token 过期：尝试刷新一次
  if (res.status === 401 && opts.auth === 'member') {
    // 成员会话优先；管理员登录的场景下回退到管理端 refresh token
    const rt = getMemberRefresh() || getAdminRefresh();
    if (rt) {
      try {
        const fresh = await rawRequest('/member/refresh', {
          method: 'POST', body: { refreshToken: rt }, auth: false,
        });
        if (fresh.res.ok && fresh.payload?.ok) {
          setMemberTokens({ accessToken: fresh.payload.data.accessToken, refreshToken: fresh.payload.data.refreshToken });
          return request(path, opts);
        }
      } catch (_) { /* 落到下面 */ }
    }
    clearMemberTokens();
  }

  if (!res.ok || (payload && payload.ok === false)) {
    const err = payload?.error || {};
    throw new ApiError(res.status, err.message || `请求失败 (${res.status})`, err.code, err.details);
  }
  return payload;
}

export const api = {
  get: (path, query, opts) => request(path, { ...opts, query }).then((r) => ({ data: r?.data, meta: r?.meta })),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }).then((r) => r?.data),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }).then((r) => r?.data),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }).then((r) => r?.data),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }).then((r) => r?.data),
  upload: (file, onProgress) => uploadWithProgress(file, onProgress),
  baseUrl: BASE,
  config: CONFIG,
};

/** 登录用户上传图片/视频（供聊天室使用） */
function uploadWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/member/upload`);
    if (memberToken) xhr.setRequestHeader('Authorization', `Bearer ${memberToken}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && json.ok) resolve(json.data);
        else reject(new ApiError(xhr.status, json?.error?.message || '上传失败'));
      } catch (_) { reject(new ApiError(xhr.status, '上传响应解析失败')); }
    };
    xhr.onerror = () => reject(new ApiError(0, '网络错误，上传失败'));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export const UPLOAD_BASE = BASE;
