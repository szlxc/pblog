/**
 * 管理端主题
 * - 与前台共用同一份账户偏好（users.preferences.theme）
 * - 未设置时回退到站点默认（settings.theme）
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from './api';

const KEY = 'pblog.admin.theme';

export function loadAdminTheme() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { mode: 'dark', accent: null, radius: null, fontSize: 'md' };
}

export function applyAdminTheme(site, t) {
  const root = document.documentElement;
  const mode = (t.mode || site?.theme?.mode || 'dark') === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (t.mode || site?.theme?.mode || 'dark');
  root.dataset.theme = mode;

  const accent = t.accent?.accent || site?.theme?.accent || '#818cf8';
  const soft = t.accent?.accentSoft || site?.theme?.accentSoft || accent;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', soft);

  if (t.radius !== null && t.radius !== undefined) {
    root.style.setProperty('--radius', `${t.radius}px`);
  } else if (site?.theme?.radius !== undefined) {
    root.style.setProperty('--radius', `${site.theme.radius}px`);
  }

  /* 界面风格：与前台同一套 data-skin 机制，
     后台也应用皮肤，管理员才能所见即所得地预览效果。 */
  const skin = t.skin || site?.theme?.skin || 'classic';
  root.dataset.skin = ['acrylic', 'liquid', 'material', 'classic'].includes(skin) ? skin : 'classic';
}

export function useAdminTheme(site) {
  const [theme, setTheme] = useState(loadAdminTheme);
  // 站点默认外观（数据库里的 settings.theme），用于回退与即时预览
  const [siteTheme, setSiteTheme] = useState(site?.theme || null);
  const timer = useRef(null);

  /* window.__PBLOG__.sites 是构建时注入的静态值，不含管理员在后台改过的
     settings.theme。这里拉一次公开的 /api/site 拿到真实生效的站点默认，
     否则后台预览的风格会和前台实际显示的不一致。
     站点设置在后台保存后会广播 pblog:site-updated，这里监听并重新拉取，
     实现「改完立刻看到效果」。 */
  useEffect(() => {
    let alive = true;
    const pull = () => {
      api.get('/site')
        .then(({ data }) => {
          if (!alive || !data?.theme) return;
          setSiteTheme(data.theme);
        })
        .catch(() => {});
    };
    pull();
    window.addEventListener('pblog:site-updated', pull);
    return () => { alive = false; window.removeEventListener('pblog:site-updated', pull); };
  }, []);

  // 启动时从服务端读取个人偏好
  useEffect(() => {
    let alive = true;
    api.get('/member/preferences')
      .then(({ data }) => {
        if (!alive || !data?.theme) return;
        const remote = data.theme;
        if (!remote || !Object.keys(remote).length) return;
        setTheme((cur) => ({ ...cur, ...remote }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 站点默认被改过（比如刚保存了设置）时同步，保证预览及时
  useEffect(() => {
    if (site?.theme) setSiteTheme((cur) => ({ ...cur, ...site.theme }));
  }, [site]);

  const effectiveSite = useMemo(
    () => ({ ...(site || {}), theme: { ...(site?.theme || {}), ...(siteTheme || {}) } }),
    [site, siteTheme]
  );

  useEffect(() => {
    applyAdminTheme(effectiveSite, theme);
    try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch (_) {}
  }, [theme, effectiveSite]);

  const update = useCallback((patch) => {
    setTheme((prev) => {
      const next = { ...prev, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        api.put('/member/preferences', {
          theme: {
            mode: next.mode,
            skin: next.skin,
            accent: next.accent,
            accentName: next.accentName,
            fontSize: next.fontSize,
            radius: next.radius,
            readingWidth: next.readingWidth,
          },
        }).catch(() => {});
      }, 800);
      return next;
    });
  }, []);

  return { theme, update, site: effectiveSite };
}
