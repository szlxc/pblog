import { useAdminTheme } from '../lib/theme';
import { Icon } from '../components/Icon';

/** 管理端外观设置：与前台共用同一套账户偏好 */
export default function Appearance() {
  const site = window.__PBLOG__?.sites || {};
  const { theme, update } = useAdminTheme(site);
  const colors = site.themeColors || {};
  const mode = theme.mode || 'dark';

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>外观设置</h2>
          <p>这里的设置保存在你的账号，前台与后台共用，换设备登录后自动恢复</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 18, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel__head"><h3>偏好</h3></div>
          <div className="panel__body">
            <div className="field">
              <label>主题模式</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  ['dark', '深色', 'moon'],
                  ['light', '浅色', 'sun'],
                  ['system', '跟随系统', 'monitor'],
                ].map(([key, label, icon]) => (
                  <button
                    key={key}
                    className={`btn ${mode === key ? 'btn--primary' : ''}`}
                    onClick={() => update({ mode: key })}
                  >
                    <Icon name={icon} size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>强调色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className={`btn ${!theme.accent ? 'btn--primary' : ''}`}
                  onClick={() => update({ accent: null, accentName: null })}
                  title="使用站点默认色"
                >
                  站点默认
                </button>
                {Object.entries(colors).map(([name, val]) => (
                  <button
                    key={name}
                    onClick={() => update({ accent: val, accentName: name })}
                    title={name}
                    aria-label={name}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${val.accent}, ${val.accentSoft || val.accent})`,
                      border: theme.accentName === name ? '2px solid var(--text)' : '1px solid var(--line)',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={theme.accent?.accent || site.theme?.accent || '#818cf8'}
                  onChange={(e) => update({ accent: { accent: e.target.value, accentSoft: e.target.value }, accentName: '自定义' })}
                  style={{ width: 36, height: 30, padding: 0, border: '1px solid var(--line)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                  aria-label="自定义颜色"
                />
              </div>
            </div>

            <div className="field">
              <label>正文字号</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['sm', '小'], ['md', '标准'], ['lg', '大']].map(([k, label]) => (
                  <button
                    key={k}
                    className={`btn ${(theme.fontSize || 'md') === k ? 'btn--primary' : ''}`}
                    onClick={() => update({ fontSize: k })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>圆角：{theme.radius ?? site.theme?.radius ?? 16}px</label>
              <input
                type="range" min="0" max="28" step="2"
                value={theme.radius ?? site.theme?.radius ?? 16}
                onChange={(e) => update({ radius: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head"><h3>说明</h3></div>
          <div className="panel__body" style={{ fontSize: '0.84rem', lineHeight: 1.8, color: 'var(--text-dim)' }}>
            <p style={{ margin: '0 0 10px' }}><strong>三层优先级</strong></p>
            <p style={{ margin: '0 0 6px' }}>1. 你在前台或后台设置的个人偏好（存在账号里）</p>
            <p style={{ margin: '0 0 6px' }}>2. 匿名访客浏览器的本地设置</p>
            <p style={{ margin: '0 0 14px' }}>3. 站点默认（「站点设置 → 主题外观」）</p>
            <p style={{ margin: 0 }}>修改会立即生效，并在约 1 秒后同步到账号。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
