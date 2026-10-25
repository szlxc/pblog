import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SiteContext from '../context/SiteContext';
import { useWallpaper } from '../hooks/useUapi';

/**
 * 页面背景
 *
 * 根据当前路由决定用哪张背景图：
 *   1. 独立页面 → pages['page:<slug>']
 *   2. 具体页面 → pages[pageKey]（home / post / archive / tags / chat / guestbook / profile / auth）
 *   3. 都没配 → global
 *   4. 都没有 → 不渲染（保持默认渐变）
 *
 * 实现方式：在 <body> 上挂一个固定定位的图层，不干扰内容布局。
 */
export default function PageBackground() {
  const { site } = SiteContext.useSite();
  const location = useLocation();

  const config = site?.backgrounds;
  const path = location.pathname;

  // 路由 → 背景 key
  const resolveKey = () => {
    if (path === '/') return 'home';
    if (path.startsWith('/post/')) return 'post';
    if (path === '/archive') return 'archive';
    if (path === '/tags') return 'tags';
    if (path === '/chat') return 'chat';
    if (path === '/guestbook') return 'guestbook';
    if (path === '/profile') return 'profile';
    if (['/login', '/register', '/forgot', '/reset', '/verify'].includes(path)) return 'auth';
    // 独立页面：从路径取 slug（Layout 层拿不到子路由的 useParams）
    if (path.startsWith('/p/')) return `page:${path.slice(3).split('/')[0]}`;
    return null;
  };

  // 只有配置了 auto 背景时才需要壁纸数据，且需 UAPI 壁纸开关打开
  const needWallpaper = !!(
    config && (
      config.global?.auto ||
      Object.values(config.pages || {}).some((p) => p?.auto)
    )
  );
  const wallpaper = useWallpaper(needWallpaper && site?.uapi?.features?.bingWallpaper !== false);

  // 判断某项配置是否「有效」（有图或开启了自动壁纸）
  const isUsable = (item) => !!(item && (item.image || item.auto));

  const bgRaw = (() => {
    if (!config) return null;
    const key = resolveKey();
    if (key && isUsable(config.pages?.[key])) return config.pages[key];
    if (isUsable(config.global)) return config.global;
    return null;
  })();

  // auto 且有壁纸数据 → 用壁纸 URL；否则用自定义图
  const bg = (() => {
    if (!bgRaw) return null;
    if (bgRaw.auto) {
      const url = wallpaper?.url4k || wallpaper?.url || '';
      return url ? { ...bgRaw, image: url } : null;
    }
    return bgRaw.image ? bgRaw : null;
  })();

  useEffect(() => {
    const root = document.documentElement;
    if (!bg?.image) {
      root.removeAttribute('data-has-bg');
      root.style.removeProperty('--page-bg-image');
      root.style.removeProperty('--page-bg-overlay');
      root.style.removeProperty('--page-bg-blur');
      root.style.removeProperty('--page-bg-attach');
      root.style.removeProperty('--page-bg-position');
      return;
    }

    root.setAttribute('data-has-bg', '1');
    root.style.setProperty('--page-bg-image', `url("${bg.image}")`);
    root.style.setProperty('--page-bg-overlay', String(bg.overlay ?? 0.55));
    root.style.setProperty('--page-bg-blur', `${bg.blur || 0}px`);
    root.style.setProperty('--page-bg-attach', bg.fixed === false ? 'scroll' : 'fixed');
    root.style.setProperty('--page-bg-position', bg.position || 'center');
  }, [bg?.image, bg?.overlay, bg?.blur, bg?.fixed, bg?.position]);

  useEffect(() => () => {
    const root = document.documentElement;
    root.removeAttribute('data-has-bg');
  }, []);

  if (!bg?.image) return null;

  return (
    <div className="page-bg" aria-hidden="true">
      <div className="page-bg__image" />
      <div className="page-bg__overlay" />
    </div>
  );
}
