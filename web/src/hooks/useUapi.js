import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { cachedFetch } from '../lib/cachedFetch';

/**
 * UAPI 数据 hooks
 * 统一走本地缓存，避免重复消耗额度。
 *
 * 缓存时长：
 *   一言      30 分钟
 *   每日壁纸  6 小时
 *   热搜      10 分钟
 *   天气      30 分钟
 */

export function useSaying(enabled = true) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!enabled) { setText(''); return undefined; }
    let alive = true;
    cachedFetch('uapi.saying', () => api.get('/uapi/saying').then((r) => r.data), {
      ttl: 30 * 60 * 1000,
      stale: false,
    }).then((d) => {
      if (!alive) return;
      setText(d?.text || '');
    }).catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return text;
}

export function useWallpaper(enabled = true) {
  const [wall, setWall] = useState(null);
  useEffect(() => {
    // 开关关闭：立即清空，不读缓存也不发请求
    if (!enabled) { setWall(null); return undefined; }

    let alive = true;
    cachedFetch('uapi.wallpaper', () => api.get('/uapi/wallpaper').then((r) => r.data), {
      ttl: 6 * 60 * 60 * 1000,
      stale: false,   // 必须拿到「当前」结果，避免开关关闭后仍显示旧图
    }).then((d) => {
      if (!alive) return;
      setWall(d?.url ? d : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return wall;
}

export function useHotboard(type, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) { setData(null); setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    cachedFetch(`uapi.hotboard.${type}`, () => api.get('/uapi/hotboard', { type }).then((r) => r.data), {
      ttl: 10 * 60 * 1000,
    }).then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [type, enabled]);

  return { data, loading };
}

export function useWeather(city, enabled = true) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) { setData(null); return undefined; }
    let alive = true;
    cachedFetch(`uapi.weather.${city || 'default'}`, () => api.get('/uapi/weather', { city }).then((r) => r.data), {
      ttl: 30 * 60 * 1000,
    }).then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [city, enabled]);
  return data;
}
