import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SiteContext from '../context/SiteContext';
import { Icon } from './Icon';

/**
 * 网易云音乐播放器（右下角可折叠小窗）
 *
 * 采用网易云官方「外链播放器」iframe：
 *   歌单 https://music.163.com/outchain/player?type=0&id=<歌单ID>
 *   单曲 https://music.163.com/outchain/player?type=2&id=<歌曲ID>
 * 优点：无需 API、无需登录、无需自己维护曲库。
 * 限制：iframe 内部样式由网易控制，只能控制外框尺寸与位置。
 */
export default function MusicPlayer() {
  const { site } = SiteContext.useSite();
  const music = site?.music;
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const panelRef = useRef(null);

  // 后台开启「显示播放器」就渲染按钮；歌单 ID 为空时在面板内提示去配置
  const enabled = !!music?.enabled && site?.plugins?.music !== false;

  useEffect(() => {
    if (!enabled) return;
    if (!touched) setOpen(!!music.defaultOpen);
  }, [enabled, music?.defaultOpen, touched]);

  // 只在首页显示时，离开首页就收起
  const allowedHere = !music?.homeOnly || location.pathname === '/';

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!enabled || !allowedHere) return null;

  return (
    <div className={`music${open ? ' is-open' : ''}`}>
      {open && (
        <div className="music__panel" ref={panelRef}>
          <div className="music__head">
            <span className="music__title">
              <Icon name="music" size={15} />
              正在播放
            </span>
            <button
              className="music__btn"
              onClick={() => { setOpen(false); setTouched(true); }}
              aria-label="收起播放器"
              title="收起"
            >
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
          {music.embedUrl ? (
            <>
              <iframe
                className="music__frame"
                title="网易云音乐播放器"
                src={music.embedUrl}
                frameBorder="no"
                border="0"
                marginWidth="0"
                marginHeight="0"
                width="100%"
                height="86"
                allow="autoplay; encrypted-media"
                referrerPolicy="no-referrer-when-downgrade"
                loading="lazy"
              />
              <a
                className="music__more"
                href={
                  music.playlistId
                    ? `https://music.163.com/#/playlist?id=${music.playlistId}`
                    : `https://music.163.com/#/song?id=${music.songId}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                在网易云打开
                <Icon name="external" size={12} />
              </a>
            </>
          ) : (
            <div className="music__empty">
              <p>还没有配置歌单</p>
              <p className="faint">请管理员在后台「音乐播放器」中填写网易云歌单 ID</p>
            </div>
          )}
        </div>
      )}

      <button
        className="music__toggle"
        onClick={() => { setOpen((v) => !v); setTouched(true); }}
        aria-label={open ? '收起播放器' : '展开播放器'}
        aria-expanded={open}
        title={open ? '收起音乐' : '播放音乐'}
      >
        {open ? <Icon name="x" size={18} /> : <Icon name="music" size={18} />}
      </button>
    </div>
  );
}
