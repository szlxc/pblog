import { useEffect } from 'react';
import SiteContext from '../context/SiteContext';
import { useMember } from '../context/MemberContext';
import { Icon } from './Icon';
import { SKINS } from '../lib/theme';

/**
 * 外观设置面板：主题模式 / 强调色 / 字号 / 圆角 / 阅读宽度
 */
export default function ThemePanel({ site, onClose }) {
  const { theme, site: siteCfg } = SiteContext.useSite();
  const { settings, update, reset, setSkin } = theme;
  const { member, status: authStatus } = useMember();
  const loggedIn = authStatus === 'authed' && !!member;
  const colors = site?.themeColors || {};
  // 站点锁定风格时，前台不允许改（由管理端统一控制）
  const skinLocked = !!siteCfg?.theme?.skinLocked;
  const activeSkin = skinLocked
    ? (siteCfg?.theme?.skin || 'classic')
    : (settings.skin || siteCfg?.theme?.skin || 'classic');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="外观设置">
      <button className="drawer-backdrop" onClick={onClose} aria-label="关闭" />
      <aside className="drawer">
        <header className="drawer__head">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>外观设置</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><Icon name="x" size={18} /></button>
        </header>

        <div className="drawer__body">
          <section className="panel-section">
            <h3>界面风格</h3>
            <p className="faint skin-hint">
              {skinLocked
                ? '本站已固定界面风格，管理员可在后台修改'
                : '切换风格会同时套用配套的明暗与配色，之后仍可单独调整'}
            </p>
            <div className="skin-grid" role="radiogroup" aria-label="界面风格" aria-disabled={skinLocked}>
              {SKINS.map((sk) => {
                const on = activeSkin === sk.key;
                return (
                  <button
                    key={sk.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={skinLocked}
                    className={`skin-card skin-card--${sk.key}${on ? ' is-active' : ''}`}
                    onClick={() => { if (!skinLocked) setSkin(sk.key); }}
                  >
                    <span className="skin-card__preview" aria-hidden="true">
                      <span className="skin-card__bar" />
                      <span className="skin-card__tile" />
                      <span className="skin-card__tile skin-card__tile--wide" />
                      <span className="skin-card__btn" />
                    </span>
                    <span className="skin-card__meta">
                      <strong>
                        {sk.label}
                        {sk.platform && <em className="skin-card__plat">{sk.platform}</em>}
                      </strong>
                      <small>{sk.desc}</small>
                    </span>
                    {on && <span className="skin-card__check"><Icon name="check" size={13} /></span>}
                  </button>
                );
              })}
            </div>
            {skinLocked && (
              <p className="faint skin-hint skin-hint--lock">
                <Icon name="lock" size={13} /> 已被管理员锁定
              </p>
            )}
          </section>

          <section className="panel-section">
            <h3>主题模式</h3>
            <div className="segmented" role="group" aria-label="主题模式">
              {[
                { key: 'dark', label: '深色', icon: 'moon' },
                { key: 'light', label: '浅色', icon: 'sun' },
                { key: 'system', label: '跟随系统', icon: 'monitor' },
              ].map((m) => (
                <button
                  key={m.key}
                  className={`segmented__item${(settings.mode || siteCfg?.theme?.mode || 'dark') === m.key ? ' is-active' : ''}`}
                  onClick={() => update({ mode: m.key })}
                  aria-pressed={(settings.mode || siteCfg?.theme?.mode || 'dark') === m.key}
                >
                  <Icon name={m.icon} size={16} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h3>强调色</h3>
            <div className="swatches">
              <button
                className={`swatch swatch--default${!settings.accent ? ' is-active' : ''}`}
                onClick={() => update({ accent: null, accentName: null })}
                title="站点默认"
                aria-label="站点默认配色"
              >
                <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))' }} />
              </button>
              {Object.entries(colors).map(([name, val]) => (
                <button
                  key={name}
                  className={`swatch${settings.accentName === name ? ' is-active' : ''}`}
                  onClick={() => update({ accent: val, accentName: name })}
                  title={name}
                  aria-label={name}
                  style={{ '--sw': val.accent }}
                >
                  <span style={{ background: `linear-gradient(135deg, ${val.accent}, ${val.accentSoft || val.accent})` }} />
                </button>
              ))}
              {/* 当前配色不来自任何预设色卡时（例如刚切换了界面风格，
                  用的是该风格的配套配色），在这里如实显示当前值，
                  否则用户会看到「一张卡都没选中」，误以为设置丢了。 */}
              {settings.accent && !colors[settings.accentName] && settings.accentName !== '自定义' && (
                <button
                  className="swatch is-active"
                  onClick={() => {}}
                  title={`当前：${settings.accentName || '自定义'}`}
                  aria-label={`当前配色 ${settings.accentName || ''}`}
                  aria-current="true"
                  style={{ '--sw': settings.accent.accent }}
                >
                  <span style={{ background: `linear-gradient(135deg, ${settings.accent.accent}, ${settings.accent.accentSoft || settings.accent.accent})` }} />
                </button>
              )}
            </div>
            <label className="field-inline">
              <span>自定义</span>
              <input
                type="color"
                value={settings.accent?.accent || site?.theme?.accent || '#6ee7b7'}
                onChange={(e) => update({ accent: { accent: e.target.value, accentSoft: e.target.value }, accentName: '自定义' })}
                aria-label="自定义强调色"
              />
            </label>
          </section>

          <section className="panel-section">
            <h3>正文字号</h3>
            <div className="segmented">
              {[
                { key: 'sm', label: '小' },
                { key: 'md', label: '标准' },
                { key: 'lg', label: '大' },
              ].map((s) => (
                <button
                  key={s.key}
                  className={`segmented__item${(settings.fontSize || siteCfg?.theme?.fontSize || 'md') === s.key ? ' is-active' : ''}`}
                  onClick={() => update({ fontSize: s.key })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h3>圆角</h3>
            <input
              className="range"
              type="range"
              min="0"
              max="28"
              step="2"
              value={settings.radius ?? (site?.theme?.radius ?? 16)}
              onChange={(e) => update({ radius: Number(e.target.value), radiusTouched: true })}
              aria-label="圆角大小"
            />
            <div className="range__meta faint"><span>直角</span><span>{settings.radius ?? site?.theme?.radius ?? 16}px</span><span>圆润</span></div>
          </section>

          <section className="panel-section">
            <h3>阅读宽度</h3>
            <input
              className="range"
              type="range"
              min="600"
              max="900"
              step="20"
              value={settings.readingWidth ?? 720}
              onChange={(e) => update({ readingWidth: Number(e.target.value) })}
              aria-label="阅读宽度"
            />
            <div className="range__meta faint"><span>紧凑</span><span>{settings.readingWidth ?? 720}px</span><span>宽松</span></div>
          </section>
        </div>

        <footer className="drawer__foot">
          <span className="faint theme-sync-hint">
            {loggedIn ? `已同步到账号「${member?.display_name || member?.username}」` : '登录后可跨设备保存你的配色'}
          </span>
          <button className="btn" onClick={reset}>恢复默认</button>
          <button className="btn btn--solid" onClick={onClose}>完成</button>
        </footer>
      </aside>
    </div>
  );
}
