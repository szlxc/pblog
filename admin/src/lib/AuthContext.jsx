import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setTokens, clearTokens, getRefreshToken, setUnauthorizedHandler, ApiError } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('booting'); // booting | authed | guest

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try { await api.post('/auth/logout', { refreshToken: rt }, { auth: false }); } catch (_) {}
    clearTokens();
    setUser(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); setStatus('guest'); });
  }, []);

  // 启动时尝试恢复会话（refresh token 有效则自动登录）
  useEffect(() => {
    let alive = true;
    (async () => {
      const rt = getRefreshToken();
      if (!rt) { setStatus('guest'); return; }
      try {
        const data = await api.post('/auth/refresh', { refreshToken: rt }, { auth: false });
        if (!alive) return;
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        setUser(data.user);
        setStatus('authed');
      } catch (_) {
        if (alive) { clearTokens(); setStatus('guest'); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password }, { auth: false });
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    setStatus('authed');
    return data.user;
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get('/auth/me');
      setUser((u) => ({ ...u, ...me.data }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); setStatus('guest'); }
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, status, login, logout, refreshMe, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return v;
}
