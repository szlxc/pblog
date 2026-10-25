import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setMemberTokens, getMemberRefresh, clearMemberTokens, getAdminRefresh } from '../lib/api';

/**
 * 当前登录身份（前台）
 *
 * 单一账号体系：
 *   - 访客账号（role=member）从前台登录
 *   - 管理员账号（role=admin/editor）从后台登录
 *   - 只要任一入口登录过，前台都会显示为已登录（同一浏览器共享）
 *
 * 会话来源（按优先级）：
 *   1. pblog.member.refresh  —— 前台自己登录的
 *   2. pblog.admin.refresh   —— 后台登录后同步过来
 */
const Ctx = createContext(null);

function isOk(role) {
  return role === 'member' || role === 'admin' || role === 'editor';
}

export function MemberProvider({ children }) {
  const [member, setMember] = useState(null);
  const [status, setStatus] = useState('booting'); // booting | guest | authed

  const setMemberData = useCallback((u) => {
    setMember(u);
    setStatus(u ? 'authed' : 'guest');
  }, []);

  /** 尝试用某个 refresh token 恢复会话 */
  const tryRestore = useCallback(async (refreshToken, source) => {
    try {
      const data = await api.post('/member/refresh', { refreshToken }, { auth: false });
      if (!isOk(data.user?.role)) return null;
      if (source === 'member') {
        setMemberTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      } else {
        // 管理员来源：用管理员 accessToken 供前台调用需登录的接口，
        // 但不覆盖 refreshToken，后台会话保持有效
        setMemberTokens({ accessToken: data.accessToken });
      }
      setMemberData(data.user);
      return data.user;
    } catch (_) {
      return null;
    }
  }, [setMemberData]);

  const restore = useCallback(async () => {
    setStatus('booting');

    // 1. 优先用前台自己的会话
    const memberRt = getMemberRefresh();
    if (memberRt) {
      const u = await tryRestore(memberRt, 'member');
      if (u) { setMemberData(u); return; }
      clearMemberTokens();
    }

    // 2. 回退到管理端会话
    const adminRt = getAdminRefresh();
    if (adminRt) {
      const u = await tryRestore(adminRt, 'admin');
      if (u) { setMemberData(u); return; }
    }

    setMemberData(null);
  }, [tryRestore, setMemberData]);

  useEffect(() => { restore(); }, [restore]);

  // 后台登录 / 退出时，前台标签页实时同步
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || !e.key.startsWith('pblog.')) return;
      restore();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [restore]);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/member/login', { username, password }, { auth: false });
    setMemberTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setMemberData(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    return api.post('/member/register', payload, { auth: false });
  }, []);

  const logout = useCallback(async () => {
    clearMemberTokens();
    setMemberData(null);
  }, []);

  const reload = useCallback(async () => {
    const { data } = await api.get('/member/me', null, { auth: 'member' });
    setMemberData(data);
    return data;
  }, []);

  const isAdmin = member && (member.role === 'admin' || member.role === 'editor');

  return (
    <Ctx.Provider value={{ member, status, isAdmin, login, register, logout, reload, restore }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMember() {
  return useContext(Ctx) || { member: null, status: 'guest', isAdmin: false, login: async () => {}, logout: async () => {} };
}
