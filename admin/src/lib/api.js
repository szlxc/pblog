/**
 * 管理端 API 客户端
 * - 后端地址来自统一配置 PBLOG.json
 * - accessToken 存内存 + sessionStorage；refreshToken 存 localStorage
 * - 401 时自动用 refreshToken 换新，失败则跳转登录
 */
const CONFIG = (typeof window !== 'undefined' && window.__PBLOG__) || { backend: { publicUrl: '' } };
const BASE = (CONFIG.backend?.publicUrl || '').replace(/\/$/, '');

const TOKEN_KEY = 'pblog.admin.access';
const REFRESH_KEY = 'pblog.admin.refresh';

let accessToken = sessionStorage.getItem(TOKEN_KEY) || null;
let refreshing = null;
let onUnauthorized = null;

export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }
export function getAccessToken() { return accessToken; }
export function setTokens({ accessToken: a, refreshToken: r }) {
  accessToken = a || null;
  if (a) sessionStorage.setItem(TOKEN_KEY, a);
  else sessionStorage.removeItem(TOKEN_KEY);
  if (r) localStorage.setItem(REFRESH_KEY, r);
  else localStorage.removeItem(REFRESH_KEY);
}
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
export function clearTokens() { setTokens({}); }

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

async function rawRequest(path, { method = 'GET', body, query, signal, auth = true, headers = {} } = {}) {
  const res = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch (_) { payload = { raw: text }; } }
  return { res, payload };
}

async function tryRefresh() {
  if (refreshing) return refreshing;
  const rt = getRefreshToken();
  if (!rt) return null;
  refreshing = (async () => {
    try {
      const { res, payload } = await rawRequest('/auth/refresh', {
        method: 'POST', body: { refreshToken: rt }, auth: false,
      });
      if (!res.ok || !payload?.ok) return null;
      setTokens({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken });
      return payload.data.user;
    } catch (_) {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request(path, opts = {}) {
  let { res, payload } = await rawRequest(path, opts);

  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ res, payload } = await rawRequest(path, opts));
    } else {
      clearTokens();
      if (onUnauthorized) onUnauthorized();
      throw new ApiError(401, '登录已过期，请重新登录', 'unauthorized');
    }
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
  base: BASE,
  config: CONFIG,

  /** 带进度的上传 */
  upload: (file, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/admin/upload`);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
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
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  }),
};
