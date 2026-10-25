/**
 * 带本地缓存的请求
 *
 * 目的：节省 UAPI 额度
 *   - 短期数据（一言、壁纸、热搜）存 localStorage
 *   - 命中未过期缓存直接返回，不发请求
 *   - 过期后先返回旧值（stale-while-revalidate），后台静默更新
 *   - 多个组件同时请求同一资源只发一次
 */
const PREFIX = 'pblog.cache.v2.';   // 版本升级会让旧缓存自动失效

const inflight = new Map();

function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (!box || typeof box.t !== 'number') return null;
    return box;
  } catch (_) {
    return null;
  }
}

function writeCache(key, value, ttl) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now(), ttl }));
  } catch (_) { /* 配额满时忽略 */ }
}

/**
 * @param {string} key     缓存键
 * @param {Function} fetcher  返回 Promise 的函数
 * @param {object} opts    { ttl: 毫秒, stale: 是否先用旧值 }
 * @returns {Promise<any>}
 */
export function cachedFetch(key, fetcher, opts = {}) {
  const ttl = opts.ttl ?? 10 * 60 * 1000;
  const staleOk = opts.stale !== false;
  const hit = readCache(key);

  const fresh = hit && (Date.now() - hit.t) < (hit.ttl ?? ttl);

  // 缓存仍然新鲜：直接返回，不发请求
  if (fresh) return Promise.resolve(hit.v);

  // 有旧值但已过期：先给旧值，同时后台刷新
  if (hit && staleOk) {
    refreshInBackground(key, fetcher, ttl);
    return Promise.resolve(hit.v);
  }

  // 没有缓存：正常请求
  return refreshInBackground(key, fetcher, ttl);
}

function refreshInBackground(key, fetcher, ttl) {
  if (inflight.has(key)) return inflight.get(key);

  const p = fetcher()
    .then((value) => {
      if (value !== undefined && value !== null) writeCache(key, value, ttl);
      return value;
    })
    .catch(() => {
      // 请求失败时退回旧缓存，避免界面空白
      const old = readCache(key);
      return old ? old.v : null;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/** 手动失效某个缓存 */
export function invalidate(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (_) {}
}

/** 清空所有缓存（设置变更后调用） */
export function clearAll() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}
