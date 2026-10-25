import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

export default function Profile() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setProfile({
      displayName: data.display_name || '', email: data.email || '', avatar: data.avatar || '', bio: data.bio || '',
      username: data.username, lastLogin: data.last_login_at,
    })).catch((e) => toast.error(e.message));
  }, [toast]);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.put('/auth/profile', {
        displayName: profile.displayName, email: profile.email,
        avatar: profile.avatar, bio: profile.bio,
      });
      await refreshMe();
      toast.toast('资料已更新');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (pwd.newPassword.length < 8) { toast.error('新密码至少 8 位'); return; }
    if (pwd.newPassword !== pwd.confirm) { toast.error('两次输入的新密码不一致'); return; }
    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      toast.toast('密码已修改，其他设备需重新登录');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!profile) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;

  return (
    <div>
      <div className="page-title">
        <div><h2>个人资料</h2><p>账号 {profile.username} · {user?.role === 'admin' ? '管理员' : '编辑'}</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 18, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel__head"><h3>基本信息</h3></div>
          <div className="panel__body">
            <div className="form-grid">
              <div className="field"><label>显示名称</label>
                <input className="input" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></div>
              <div className="field"><label>邮箱</label>
                <input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
              <div className="field field--full"><label>头像地址</label>
                <input className="input" value={profile.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} placeholder="https://…" /></div>
              <div className="field field--full"><label>个人简介</label>
                <textarea className="textarea" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={saveProfile} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存资料
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel">
            <div className="panel__head"><h3>修改密码</h3></div>
            <div className="panel__body">
              <div className="field"><label>当前密码</label>
                <input className="input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} autoComplete="current-password" /></div>
              <div className="field"><label>新密码（至少 8 位）</label>
                <input className="input" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} autoComplete="new-password" /></div>
              <div className="field"><label>确认新密码</label>
                <input className="input" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} autoComplete="new-password" /></div>
              <button className="btn btn--block" onClick={savePassword} disabled={busy}>更新密码</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>账号信息</h3></div>
            <div className="panel__body" style={{ fontSize: '0.86rem', color: 'var(--text-dim)' }}>
              <p style={{ margin: '0 0 8px' }}>用户名：<span className="num">{profile.username}</span></p>
              <p style={{ margin: 0 }}>上次登录：{profile.lastLogin ? new Date(profile.lastLogin).toLocaleString('zh-CN', { hour12: false }) : '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
