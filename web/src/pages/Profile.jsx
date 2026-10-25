import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useMember } from '../context/MemberContext';
import SiteContext from '../context/SiteContext';
import { Icon } from '../components/Icon';
import { formatDate, relativeTime } from '../lib/format';

const MOOD_LABEL = { happy: '开心', love: '喜欢', think: '思考', cool: '酷', sad: '难过' };

export default function Profile() {
  const { member, status, isAdmin, logout, reload } = useMember();
  const { site, theme } = SiteContext.useSite();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const [form, setForm] = useState({ displayName: '', bio: '', avatar: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (status === 'guest') navigate('/login', { state: { from: '/profile' }, replace: true });
  }, [status, navigate]);

  const load = () => {
    api.get('/member/dashboard', null, { auth: 'member' })
      .then(({ data: d }) => {
        setData(d);
        setForm({
          displayName: d.user.display_name || '',
          bio: d.user.bio || '',
          avatar: d.user.avatar || '',
        });
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { if (status === 'authed') load(); }, [status]);

  const saveProfile = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.put('/member/profile', {
        displayName: form.displayName,
        bio: form.bio,
        avatar: form.avatar,
      }, { auth: 'member' });
      await reload();
      load();
      setMsg({ ok: true, text: '资料已保存' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (pwd.newPassword.length < 8) { setMsg({ ok: false, text: '新密码至少 8 位' }); return; }
    if (pwd.newPassword !== pwd.confirm) { setMsg({ ok: false, text: '两次密码不一致' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api.put('/member/password', {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      }, { auth: 'member' });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ ok: true, text: '密码已修改' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  };

  const doLogout = async () => {
    await logout();
    navigate('/');
  };

  if (status === 'booting' || !data) {
    return <div className="container" style={{ padding: '80px 0' }}><div className="skeleton" style={{ height: 200, borderRadius: 16 }} /></div>;
  }

  const u = data.user;
  const name = u.display_name || u.username;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="container profile-page">
      {/* ---------- 顶部身份卡 ---------- */}
      <header className="profile-hero card">
        <div className="profile-hero__avatar">
          {u.avatar ? <img src={u.avatar} alt="" /> : initial}
        </div>
        <div className="profile-hero__info">
          <div className="profile-hero__name">
            <h1>{name}</h1>
            {isAdmin ? <span className="chip chip--accent">管理员</span> : <span className="chip">用户</span>}
          </div>
          <p className="faint">@{u.username} · 加入于 {formatDate(u.created_at, 'cn')}</p>
          {u.bio && <p className="profile-hero__bio">{u.bio}</p>}
        </div>
        <div className="profile-hero__actions">
          {isAdmin && (
            <a className="btn btn--sm" href="/admin/"><Icon name="settings" size={14} />管理后台</a>
          )}
          <button className="btn btn--sm btn--ghost" onClick={doLogout}><Icon name="logout" size={14} />退出</button>
        </div>
      </header>

      {/* ---------- 数据卡 ---------- */}
      <div className="profile-stats">
        <div className="profile-stat card">
          <span className="faint">聊天消息</span>
          <strong>{data.stats.chatCount}</strong>
        </div>
        <div className="profile-stat card">
          <span className="faint">留言</span>
          <strong>{data.stats.guestbookCount}</strong>
        </div>
        <div className="profile-stat card">
          <span className="faint">评论</span>
          <strong>{data.stats.commentCount}</strong>
        </div>
      </div>

      {/* ---------- 标签页 ---------- */}
      <nav className="profile-tabs">
        {[
          ['overview', '动态'],
          ['settings', '资料设置'],
          ['password', '修改密码'],
          ['appearance', '外观设置'],
        ].map(([k, label]) => (
          <button key={k} className={`profile-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      {msg && <p className={msg.ok ? 'text-ok' : 'text-err'} style={{ margin: '0 0 14px' }}>{msg.text}</p>}
      {error && <p className="text-err">{error}</p>}

      {/* ---------- 动态 ---------- */}
      {tab === 'overview' && (
        <div className="profile-grid">
          <section className="panel profile-panel">
            <div className="panel__head"><h3>最近的聊天</h3></div>
            <div className="profile-list">
              {data.recentChat.length === 0 && <p className="faint" style={{ margin: 0 }}>还没有发过消息</p>}
              {data.recentChat.map((c) => (
                <Link key={c.id} to={`/chat?room=${c.room}`} className="profile-list__item">
                  <span className="chip chip--mini">{c.room === 'members' ? '用户房' : '公共房'}</span>
                  <span className="profile-list__text">{c.content || (c.media_type === 'video' ? '[视频]' : '[图片]')}</span>
                  <span className="faint">{relativeTime(c.created_at)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel profile-panel">
            <div className="panel__head"><h3>最近的留言</h3></div>
            <div className="profile-list">
              {data.recentGuestbook.length === 0 && <p className="faint" style={{ margin: 0 }}>还没有留过言</p>}
              {data.recentGuestbook.map((g) => (
                <Link key={g.id} to="/guestbook" className="profile-list__item">
                  <span className="profile-list__text">{g.content}</span>
                  <span className="faint">{relativeTime(g.created_at)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ---------- 资料 ---------- */}
      {tab === 'settings' && (
        <section className="panel profile-panel">
          <div className="panel__head"><h3>基本资料</h3></div>
          <div className="panel__body">
            <div className="form-grid">
              <div className="field">
                <label>显示名称</label>
                <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={64} />
              </div>
              <div className="field">
                <label>头像地址</label>
                <input className="input" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://…" />
              </div>
              <div className="field field--full">
                <label>个人简介</label>
                <textarea className="textarea" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} />
              </div>
              <div className="field field--full">
                <label>邮箱（不可修改）</label>
                <input className="input" value={u.email || '未绑定'} readOnly />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={saveProfile} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存资料
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- 密码 ---------- */}
      {tab === 'password' && (
        <section className="panel profile-panel">
          <div className="panel__head"><h3>修改密码</h3></div>
          <div className="panel__body">
            <div className="field"><label>当前密码</label>
              <input className="input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} autoComplete="current-password" /></div>
            <div className="field"><label>新密码（至少 8 位）</label>
              <input className="input" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} autoComplete="new-password" /></div>
            <div className="field"><label>确认新密码</label>
              <input className="input" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} autoComplete="new-password" /></div>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={savePassword} disabled={busy}>更新密码</button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- 外观 ---------- */}
      {tab === 'appearance' && (
        <section className="panel profile-panel">
          <div className="panel__head"><h3>外观设置</h3></div>
          <div className="panel__body">
            <p className="faint" style={{ marginTop: 0 }}>
              这里的设置会保存到你的账号，换设备登录后自动应用。
              未设置时使用站点默认外观。
            </p>
            <div className="appearance-summary">
              <div><span className="faint">当前模式</span><strong>{{ dark: '深色', light: '浅色', system: '跟随系统' }[theme.settings.mode] || '站点默认'}</strong></div>
              <div><span className="faint">强调色</span><strong>{theme.settings.accentName || (theme.settings.accent ? '自定义' : '站点默认')}</strong></div>
              <div><span className="faint">字号</span><strong>{{ sm: '小', md: '标准', lg: '大' }[theme.settings.fontSize] || '标准'}</strong></div>
              <div><span className="faint">圆角</span><strong>{theme.settings.radius ?? site?.theme?.radius ?? 16}px</strong></div>
              <div><span className="faint">阅读宽度</span><strong>{theme.settings.readingWidth ?? 720}px</strong></div>
            </div>
            <div className="form-actions">
              <button className="btn" onClick={() => theme.reset()}>恢复站点默认</button>
            </div>
            <p className="faint" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
              提示：点击页面右上角的「外观」按钮可以随时调整，修改会自动保存到账号。
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
