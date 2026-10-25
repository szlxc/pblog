import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { useToast } from './ui';
import { useAdminTheme } from '../lib/theme';

const NAV = [
  {
    group: '概览',
    items: [{ to: '/', label: '仪表盘', icon: 'dashboard', end: true }],
  },
  {
    group: '内容',
    items: [
      { to: '/posts', label: '文章', icon: 'file' },
      { to: '/pages', label: '独立页面', icon: 'menuBook' },
      { to: '/media', label: '媒体库', icon: 'image' },
    ],
  },
  {
    group: '分类与标签',
    items: [
      { to: '/categories', label: '分类', icon: 'folder' },
      { to: '/tags', label: '标签', icon: 'tag' },
    ],
  },
  {
    group: '互动',
    items: [
      { to: '/comments', label: '评论', icon: 'message', badgeKey: 'pendingComments' },
      { to: '/guestbook', label: '留言墙', icon: 'message-square' },
      { to: '/chat', label: '聊天室', icon: 'message' },
      { to: '/links', label: '友链', icon: 'link' },
    ],
  },
  {
    group: '用户',
    items: [
      { to: '/members', label: '用户管理', icon: 'user' },
    ],
  },
  {
    group: '外观',
    items: [
      { to: '/appearance', label: '外观设置', icon: 'sun' },
      { to: '/backgrounds', label: '页面背景', icon: 'image' },
      { to: '/effects', label: '点击特效', icon: 'hero' },
      { to: '/guestbook-style', label: '留言墙外观', icon: 'message-square' },
      { to: '/music', label: '音乐播放器', icon: 'music' },
    ],
  },
  {
    group: '系统',
    items: [
      { to: '/settings', label: '站点设置', icon: 'settings' },
      { to: '/mail', label: '邮件设置', icon: 'mail' },
      { to: '/uapi', label: 'UAPI 集成', icon: 'chart' },
      { to: '/audit', label: '操作日志', icon: 'shield' },
    ],
  },
];

const TITLES = {
  '/': '仪表盘', '/posts': '文章管理', '/posts/new': '写文章', '/pages': '独立页面',
  '/categories': '分类管理', '/tags': '标签管理', '/comments': '评论管理', '/media': '媒体库',
  '/links': '友情链接', '/settings': '站点设置', '/audit': '操作日志', '/profile': '个人资料',
  '/guestbook': '留言墙管理', '/chat': '聊天室管理', '/members': '用户管理',
  '/music': '音乐播放器', '/mail': '邮件设置', '/appearance': '外观设置', '/guestbook-style': '留言墙外观', '/backgrounds': '页面背景', '/uapi': 'UAPI 集成', '/effects': '点击特效',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const toast = useToast();
  const site = window.__PBLOG__?.sites || {};
  const { theme, update: updateTheme } = useAdminTheme(site);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data }) => setCounts(data.counters || {})).catch(() => {});
  }, [location.pathname]);

  const title = TITLES[location.pathname] || (location.pathname.startsWith('/posts/') ? '编辑文章' : '控制台');

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' is-open' : ''}`}>
        <div className="sidebar__brand">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <path d="M9 5h7L9 27H4L9 5z" fill="var(--accent)" />
            <path d="M18 5h8L18 27h-6L18 5z" fill="var(--accent)" opacity="0.5" />
          </svg>
          <div>
            <strong>{site.admin?.logoText || site.frontend?.title || 'PBLOG'}</strong>
            <em>控制台</em>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="sidebar__group">{g.group}</p>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                  {item.badgeKey && counts[item.badgeKey] > 0 && (
                    <span className="badge">{counts[item.badgeKey]}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <a className="nav-item" href={site.frontend?.siteUrl || "/"} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={17} /><span>访问前台</span>
          </a>
          <div className="user-mini">
            <span className="user-mini__avatar">{(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}</span>
            <div className="user-mini__meta grow">
              <strong>{user?.displayName || user?.username}</strong>
              <span>{user?.role === 'admin' ? '管理员' : '编辑'}</span>
            </div>
            <button className="icon-btn" onClick={onLogout} title="退出登录" aria-label="退出登录">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="打开菜单">
            <Icon name="menu" size={18} />
          </button>
          <h1>{title}</h1>
          <div className="topbar__actions">
            <button
              className="icon-btn" title="切换深浅色" aria-label="切换深浅色"
              onClick={() => updateTheme({ mode: (theme.mode || 'dark') === 'dark' ? 'light' : 'dark' })}
            >
              <Icon name={(theme.mode || 'dark') === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
            <button
              className="icon-btn" title="外观设置" aria-label="外观设置"
              onClick={() => navigate('/appearance')}
            >
              <Icon name="settings" size={17} />
            </button>
            <button className="icon-btn" title="个人资料" aria-label="个人资料" onClick={() => navigate('/profile')}>
              <Icon name="user" size={17} />
            </button>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => navigate('/posts/new')}
              title="新建文章"
            >
              <Icon name="plus" size={15} />写文章
            </button>
          </div>
        </header>
        <div className="content">
          <Outlet context={{ toast }} />
        </div>
      </div>
    </div>
  );
}
