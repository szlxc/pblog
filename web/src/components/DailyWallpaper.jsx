import { useEffect, useState } from 'react';
import { useWallpaper } from '../hooks/useUapi';
import { Icon } from './Icon';

/**
 * 必应每日壁纸卡片
 * 展示当日壁纸缩略图 + 标题，点击可查看大图。
 */
export default function DailyWallpaper({ enabled = true }) {
  const wall = useWallpaper(enabled);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!wall || failed) return null;

  return (
    <>
      <figure className="wallpaper card">
        <button
          className="wallpaper__thumb"
          onClick={() => setOpen(true)}
          aria-label="查看每日壁纸大图"
        >
          <img
            src={wall.url}
            alt={wall.title || '每日壁纸'}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </button>
        <figcaption className="wallpaper__meta">
          <div className="wallpaper__head">
            <Icon name="image" size={13} />
            <span className="eyebrow">每日壁纸</span>
            {wall.date && <span className="faint wallpaper__date">{wall.date}</span>}
          </div>
          <p className="wallpaper__title">{wall.title}</p>
          {wall.subtitle && <p className="wallpaper__sub faint">{wall.subtitle}</p>}
        </figcaption>
      </figure>

      {open && (
        <div className="wallpaper-viewer" onClick={() => setOpen(false)}>
          <button className="wallpaper-viewer__close" aria-label="关闭">
            <Icon name="x" size={22} />
          </button>
          <div className="wallpaper-viewer__inner" onClick={(e) => e.stopPropagation()}>
            <img src={wall.url4k || wall.url} alt={wall.title} />
            <div className="wallpaper-viewer__caption">
              <strong>{wall.title}</strong>
              {wall.copyright && <span className="faint">{wall.copyright}</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
