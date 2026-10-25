import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import SiteContext from '../context/SiteContext';
import ThemePanel from './ThemePanel';
import SearchOverlay from './SearchOverlay';
import MusicPlayer from './MusicPlayer';
import PageBackground from './PageBackground';
import ClickEffect from './effects/ClickEffect';
import { CAN_TRANSITION } from '../lib/viewTransition';
import MemberMenu from './MemberMenu';
import { Icon } from './Icon';
import { formatDate } from '../lib/format';

export default function Layout({ children }) {
  const { site, theme } = SiteContext.useSite();
  const [openPanel, setOpenPanel] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenSearch(true);
      }
      if (e.key === 'Escape') { setOpenSearch(false); setOpenPanel(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = site?.nav || [];
  const pages = (site?.pages || []).map((p) => ({ label: p.title, to: `/p/${p.slug}` }));
  const allNav = [...nav, ...pages];

  return (
    <div className="shell">
      <PageBackground />
      <ClickEffect
        enabled={!!site?.effects?.click?.enabled}
        themeColor={site?.effects?.click?.color || site?.theme?.accent || '#6ee7b7'}
        trailAlways={!!site?.effects?.click?.trail}
      />
      <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
        <div className="header__inner container">
          <Link to="/" {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="brand" aria-label={site?.frontend?.title || '首页'}>
            {site?.frontend?.logoImage ? (
              <img src={site.frontend.logoImage} alt="" className="brand__logo" />
            ) : (
              <span className="brand__mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="26" height="26">
                  <path d="M9 5h7L9 27H4L9 5z" fill="var(--accent)" />
                  <path d="M18 5h8L18 27h-6L18 5z" fill="var(--accent)" opacity="0.5" />
                </svg>
              </span>
            )}
            <span className="brand__text">
              <strong>{site?.frontend?.logoText || site?.frontend?.title}</strong>
              {site?.frontend?.subtitle && <em>{site.frontend.subtitle}</em>}
            </span>
          </Link>

          <nav className={`nav${menuOpen ? ' nav--open' : ''}`} aria-label="主导航">
            {allNav.map((item) => (
              item.external ? (
                <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className="nav__link">
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  {...(CAN_TRANSITION ? { viewTransition: true } : {})}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>

          <div className="header__actions">
            {site?.plugins?.member !== false && <MemberMenu />}
            {site?.plugins?.search && (
              <button className="icon-btn" onClick={() => setOpenSearch(true)} aria-label="搜索 (Ctrl+K)">
                <Icon name="search" size={18} />
              </button>
            )}
            <button className="icon-btn" onClick={() => setOpenPanel(true)} aria-label="外观设置">
              <Icon name="sliders" size={18} />
            </button>
            <button
              className="icon-btn nav-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="菜单"
              aria-expanded={menuOpen}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* 全屏页面（聊天室/留言墙）自身控制定位，不加过渡包裹 */}
        {children}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <strong>{site?.frontend?.title}</strong>
            <p className="muted">{site?.frontend?.description}</p>
          </div>
          <div className="footer__meta">
            <div className="footer__social">
              {(site?.social || []).map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="chip">
                  {s.label}
                </a>
              ))}
            </div>
            <p className="faint footer__copy">
              {(site?.frontend?.footerText || '').replace('{year}', new Date().getFullYear())}
            </p>
            {site?.frontend?.icp && (
              <p className="faint">
                <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{site.frontend.icp}</a>
              </p>
            )}
          </div>
        </div>
        <div className="container footer__stats">
          <span className="faint">
            {site?.stats ? `${site.stats.posts} 篇文章 · ${site.stats.tags} 个标签 · ${formatDate(new Date(), 'iso')}` : ''}
          </span>
        </div>
      </footer>

      {openPanel && <ThemePanel site={site} onClose={() => setOpenPanel(false)} />}
      {openSearch && <SearchOverlay onClose={() => setOpenSearch(false)} />}
      <MusicPlayer />
      {site?.plugins?.backToTop && <BackToTop />}
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  if (!show) return null;
  return (
    <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部">
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
