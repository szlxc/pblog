import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

/**
 * 点击特效配置
 *
 * 基于开源项目 ba-click-fx（蔚蓝档案风格，MIT）
 * https://github.com/CialloKing/ba-click-fx
 */
const STYLES = [
  { key: 'bluearchive', name: '蔚蓝档案', desc: '圆环 + 碎片 + 辉光，还原游戏内点击反馈', color: '#6ee7b7' },
  { key: 'spark', name: '星河', desc: '细碎光点四散，适合深色主题', color: '#818cf8' },
  { key: 'ripple', name: '涟漪', desc: '柔和扩散波纹，克制不抢眼', color: '#67e8f9' },
  { key: 'confetti', name: '彩纸', desc: '彩色纸屑迸发，活泼轻快', color: '#fbbf24' },
];

export default function EffectsSettings() {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => {
        const e = data.overrides.effects || {};
        setCfg({
          click: {
            enabled: e.click?.enabled === true,
            style: e.click?.style || 'bluearchive',
            color: e.click?.color || '',
            trail: e.click?.trail !== false,   // 默认开启
          },
        });
      })
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/settings/effects', { value: cfg });
      toast.toast('已保存，前台刷新后生效');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;
  const setClick = (patch) => setCfg((c) => ({ ...c, click: { ...c.click, ...patch } }));
  const active = STYLES.find((s) => s.key === cfg.click.style) || STYLES[0];

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>点击特效</h2>
          <p>站点点击、拖尾视觉反馈，基于开源项目 ba-click-fx（MIT）</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel">
            <div className="panel__head"><h3>开关</h3></div>
            <div className="panel__body">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem', marginBottom: 16 }}>
                <input
                  type="checkbox" style={{ marginTop: 3 }}
                  checked={!!cfg.click.enabled}
                  onChange={(e) => setClick({ enabled: e.target.checked })}
                />
                <span>
                  <strong>启用点击特效</strong>
                  <br />
                  <span className="faint" style={{ fontSize: '0.8rem' }}>
                    关闭后前台不加载特效资源。系统开启「减少动画」的访客不会看到特效。
                  </span>
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}>
                <input
                  type="checkbox" style={{ marginTop: 3 }}
                  checked={!!cfg.click.trail}
                  onChange={(e) => setClick({ trail: e.target.checked })}
                />
                <span>
                  <strong>光标拖尾</strong>
                  <br />
                  <span className="faint" style={{ fontSize: '0.8rem' }}>
                    开启后移动鼠标即出现拖尾（默认需按住拖动）
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>特效风格</h3></div>
            <div className="panel__body">
              <div className="fx-grid">
                {STYLES.map((st) => (
                  <button
                    key={st.key}
                    className={`fx-card${cfg.click.style === st.key ? ' is-active' : ''}`}
                    onClick={() => setClick({ style: st.key, color: cfg.click.color || st.color })}
                  >
                    <span className="fx-card__dot" style={{ background: st.color }} />
                    <strong>{st.name}</strong>
                    <span className="fx-card__desc">{st.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>主题色</h3></div>
            <div className="panel__body">
              <div className="color-row" style={{ alignItems: 'center', gap: 12 }}>
                <input
                  type="color"
                  value={cfg.click.color || active.color}
                  onChange={(e) => setClick({ color: e.target.value })}
                />
                <input
                  className="input"
                  style={{ maxWidth: 140 }}
                  value={cfg.click.color || ''}
                  onChange={(e) => setClick({ color: e.target.value })}
                  placeholder={active.color}
                />
                <button className="btn btn--sm btn--ghost" onClick={() => setClick({ color: '' })}>
                  跟随站点强调色
                </button>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>
                留空时自动使用「外观设置」里的强调色，保持一致。
              </p>
            </div>
          </div>
        </div>

        <div className="panel" style={{ position: 'sticky', top: 0 }}>
          <div className="panel__head"><h3>预览</h3></div>
          <div className="panel__body">
            <div className="fx-preview" style={{ '--fx-color': cfg.click.color || active.color }}>
              <div className="fx-preview__ring" />
              <div className="fx-preview__core" />
              <span className="fx-preview__label">{active.name}</span>
            </div>
            <p className="faint" style={{ fontSize: '0.78rem', margin: '14px 0 0', lineHeight: 1.7 }}>
              这是配色示意。真实效果请到前台点击任意位置查看，
              动画由 WebGL2 渲染。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
