import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Icon } from '../components/Icon';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const site = window.__PBLOG__?.sites || {};

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.username.trim(), form.password);
      const to = location.state?.from || '/';
      navigate(to, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-logo">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <path d="M9 5h7L9 27H4L9 5z" fill="var(--accent)" />
            <path d="M18 5h8L18 27h-6L18 5z" fill="var(--accent)" opacity="0.5" />
          </svg>
          <span className="eyebrow" style={{ color: 'var(--text-faint)', letterSpacing: '0.16em', fontSize: '0.7rem' }}>
            {site.admin?.shortName || 'PBLOG'}
          </span>
        </div>
        <h1>{site.admin?.title || '登录控制台'}</h1>
        <p className="sub">使用管理员账号登录，管理文章与站点设置。</p>

        <div className="field">
          <label htmlFor="username">用户名</label>
          <input
            id="username" className="input" autoComplete="username" autoFocus
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="admin"
          />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password" className="input" type="password" autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: '0 0 14px' }} role="alert">{error}</p>
        )}

        <button className="btn btn--primary btn--block" type="submit" disabled={busy || !form.username || !form.password}>
          {busy ? <><span className="spinner" />登录中</> : <>登录<Icon name="chevronRight" size={15} /></>}
        </button>

        <p style={{ marginTop: 18, fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center' }}>
          接口地址 {apiHost()}
        </p>
      </form>
    </div>
  );
}

function apiHost() {
  return window.__PBLOG__?.backend?.publicUrl || '(未配置 backend.publicUrl)';
}
