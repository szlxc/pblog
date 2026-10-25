import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useMember } from './MemberContext';

/**
 * 站点全局状态
 *   - site：站点信息（来自 /api/site，可被管理端覆盖）
 *   - theme：主题偏好（个人 > 本机 > 站点默认）
 *
 * 注意：必须放在 MemberProvider 内部，才能感知登录状态并同步个人主题。
 */
const Ctx = createContext(null);

const FALLBACK = {
  frontend: {}, theme: {}, themeColors: {}, nav: [], social: [],
  plugins: {}, pages: [], stats: null, music: null, community: {},
};

export function SiteProvider({ children }) {
  const [site, setSite] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const { member, status: authStatus } = useMember();

  /* ---------- 账户级主题同步器 ---------- */
  const syncer = useMemo(() => {
    const enabled = authStatus === 'authed' && !!member;
    return {
      enabled,
      load: async () => {
        const { data } = await api.get('/member/preferences', null, { auth: 'member' });
        return { preferences: data };
      },
      save: async (settings) => {
        await api.put('/member/preferences', {
          theme: {
            mode: settings.mode,
            accent: settings.accent,
            accentName: settings.accentName,
            fontSize: settings.fontSize,
            skin: settings.skin,
            radius: settings.radius,
            radiusTouched: settings.radiusTouched,
            readingWidth: settings.readingWidth,
          },
        }, { auth: 'member' });
      },
    };
  }, [authStatus, member]);

  const themeState = useTheme(site, syncer);

  const load = useCallback(async () => {
    try {
      setStatus('loading');
      const { data } = await api.get('/site');
      setSite(data);
      setStatus('ready');
      setError(null);
      if (data?.frontend?.title) document.title = data.frontend.title;
      if (data?.frontend?.description) {
        let m = document.querySelector('meta[name="description"]');
        if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
        m.content = data.frontend.description;
      }
      if (data?.frontend?.favicon) {
        let l = document.querySelector('link[rel="icon"]');
        if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
        l.href = data.frontend.favicon;
      }
    } catch (e) {
      setStatus('error');
      setError(e.message);
      setSite(FALLBACK);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Ctx.Provider value={{ site, status, error, reload: load, theme: themeState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSiteContext() {
  return useContext(Ctx) || { site: FALLBACK, status: 'error', theme: null };
}

const SiteContext = { useSite: useSiteContext, Provider: SiteProvider };
export default SiteContext;
export { SiteProvider as Provider };
