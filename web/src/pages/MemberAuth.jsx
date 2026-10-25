import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMember } from '../context/MemberContext';
import SiteContext from '../context/SiteContext';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';

/**
 * 访客登录 / 注册 / 邮箱验证 / 找回密码
 * 通过 mode 区分：login | register | verify | forgot | reset
 */
export default function MemberAuth({ mode = 'login' }) {
  const { site } = SiteContext.useSite();
  const { login, register, status } = useMember();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [form, setForm] = useState({ username: '', password: '', password2: '', email: '', displayName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const community = site?.community || {};
  const from = location.state?.from || '/chat';

  useEffect(() => {
    if (status === 'authed' && (mode === 'login' || mode === 'register')) {
      navigate(from, { replace: true });
    }
  }, [status, mode, navigate, from]);

  // 验证链接：?token=xxx
  useEffect(() => {
    if (mode !== 'verify') return;
    const token = params.get('token');
    if (!token) { setError('缺少验证令牌'); return; }
    setBusy(true);
    api.post('/member/verify', { token })
      .then(() => setInfo('邮箱验证成功，现在可以登录了'))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [mode, params]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.username.trim(), form.password);
        navigate(from, { replace: true });
      } else if (mode === 'register') {
        if (form.password !== form.password2) throw new Error('两次输入的密码不一致');
        const res = await register({
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || undefined,
          displayName: form.displayName.trim() || undefined,
        });
        setInfo(res.message || '注册成功');
        if (!res.needVerify) {
          await login(form.username.trim(), form.password);
          navigate(from, { replace: true });
        }
      } else if (mode === 'forgot') {
        const res = await api.post('/member/forgot', { email: form.email.trim() });
        setInfo(res.message || '如果该邮箱已注册，重置邮件将很快送达');
      } else if (mode === 'reset') {
        if (form.password !== form.password2) throw new Error('两次输入的密码不一致');
        await api.post('/member/reset', { token: params.get('token') || '', password: form.password });
        setInfo('密码已重置，请重新登录');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const TITLES = {
    login: ['登录', '登录后可以进入用户聊天室，发送图片和视频'],
    register: ['注册账号', '注册后可进入用户专属聊天室'],
    verify: ['邮箱验证', ''],
    forgot: ['找回密码', '填写注册时使用的邮箱，我们会发送重置链接'],
    reset: ['重置密码', '设置一个新的密码'],
  };
  const [title, sub] = TITLES[mode] || TITLES.login;

  return (
    <div className="auth-page container">
      <div className="auth-card card">
        <div className="auth-head">
          <p className="eyebrow">Account</p>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>

        {error && <p className="text-err" role="alert">{error}</p>}
        {info && <p className="text-ok" role="status">{info}</p>}

        {mode === 'verify' ? (
          <div className="auth-links">
            {info ? <Link className="btn btn--solid" to="/login">去登录</Link> : null}
            {!busy && !info && <Link className="btn" to="/login">返回登录</Link>}
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            {mode !== 'forgot' && mode !== 'reset' && (
              <label className="field">
                <span>用户名</span>
                <input
                  className="input" autoComplete="username" required
                  value={form.username} onChange={(e) => set({ username: e.target.value })}
                  placeholder="2-20 位字母、数字或中文"
                />
              </label>
            )}

            {mode === 'register' && (
              <>
                <label className="field">
                  <span>显示名称（选填）</span>
                  <input className="input" value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder="默认与用户名相同" />
                </label>
                <label className="field">
                  <span>邮箱（选填{community.requireEmailVerify ? '，用于验证' : ''}）</span>
                  <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" />
                </label>
              </>
            )}

            {(mode === 'forgot') && (
              <label className="field">
                <span>邮箱</span>
                <input className="input" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </label>
            )}

            {mode !== 'forgot' && (
              <label className="field">
                <span>{mode === 'reset' ? '新密码' : '密码'}</span>
                <input
                  className="input" type="password" required minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password} onChange={(e) => set({ password: e.target.value })}
                  placeholder="至少 8 位"
                />
              </label>
            )}

            {(mode === 'register' || mode === 'reset') && (
              <label className="field">
                <span>确认密码</span>
                <input className="input" type="password" required value={form.password2} onChange={(e) => set({ password2: e.target.value })} />
              </label>
            )}

            <button className="btn btn--solid btn--block" type="submit" disabled={busy}>
              {busy ? <><Icon name="loader" size={15} className="spin" />处理中</> : title}
            </button>
          </form>
        )}

        <div className="auth-links">
          {mode === 'login' && (
            <>
              {community.registerOpen !== false && <Link to="/register">没有账号？注册</Link>}
              <Link to="/forgot">忘记密码</Link>
              <Link to="/chat">返回聊天室</Link>
            </>
          )}
          {mode === 'register' && <Link to="/login">已有账号？登录</Link>}
          {mode === 'forgot' && <Link to="/login">返回登录</Link>}
          {mode === 'reset' && <Link to="/login">去登录</Link>}
          {mode === 'verify' && <Link to="/">返回首页</Link>}
        </div>
      </div>
    </div>
  );
}
