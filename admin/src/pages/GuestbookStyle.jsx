import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

const PRESETS = [
  { name: '素雅', colors: ['#e8edf2', '#cbd5e1', '#94a3b8', '#6ee7b7'] },
  { name: '清新', colors: ['#6ee7b7', '#67e8f9', '#a5b4fc', '#86efac'] },
  { name: '暖调', colors: ['#fbbf24', '#fb923c', '#fda4af', '#e8edf2'] },
  { name: '冷调', colors: ['#818cf8', '#67e8f9', '#93c5fd', '#cbd5e1'] },
  { name: '霓虹', colors: ['#6ee7b7', '#fb7185', '#818cf8', '#fbbf24', '#67e8f9'] },
];

export default function GuestbookStyle() {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/admin/guestbook-style').then(({ data }) => setCfg(data)).catch((e) => toast.error(e.message));
  }, [toast]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/guestbook-style', cfg);
      toast.toast('已保存，前台刷新后生效');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  const toggleColor = (hex) => {
    const has = cfg.colors.includes(hex);
    const next = has ? cfg.colors.filter((c) => c !== hex) : [...cfg.colors, hex];
    if (!next.length) { toast.error('至少保留一种颜色'); return; }
    set({ colors: next });
  };

  const updateColor = (idx, hex) => {
    const next = cfg.colors.slice();
    next[idx] = hex;
    set({ colors: next });
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>留言墙外观</h2>
          <p>控制弹幕的颜色、字号与滚动速度，保存后前台立即生效</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {/* 配色 */}
          <div className="panel">
            <div className="panel__head"><h3>弹幕配色池</h3><span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-faint)' }}>仅使用这些颜色</span></div>
            <div className="panel__body">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {cfg.colors.map((hex, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <input
                      type="color" value={hex}
                      onChange={(e) => updateColor(i, e.target.value)}
                      style={{ width: 44, height: 36, padding: 0, border: '1px solid var(--line)', borderRadius: 8, background: 'none', cursor: 'pointer' }}
                      aria-label={`颜色 ${i + 1}`}
                    />
                    <button
                      onClick={() => toggleColor(hex)}
                      title="移除"
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-panel)', border: '1px solid var(--line-strong)', display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}
                    >×</button>
                  </div>
                ))}
                <button
                  className="btn btn--sm"
                  onClick={() => set({ colors: [...cfg.colors, '#a5b4fc'] })}
                  disabled={cfg.colors.length >= 16}
                >
                  <Icon name="plus" size={14} />添加
                </button>
              </div>

              <p className="faint" style={{ margin: '0 0 8px', fontSize: '0.8rem' }}>快速套用预设</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <button key={p.name} className="btn btn--sm" onClick={() => set({ colors: p.colors })}>
                    <span style={{ display: 'inline-flex', gap: 3 }}>
                      {p.colors.map((c) => (
                        <span key={c} style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                      ))}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 字号与速度 */}
          <div className="panel">
            <div className="panel__head"><h3>字号与速度</h3></div>
            <div className="panel__body">
              <div className="form-grid">
                <div className="field">
                  <label>最小字号：{cfg.minFontSize}px</label>
                  <input type="range" min="11" max="28" step="1" value={cfg.minFontSize}
                    onChange={(e) => set({ minFontSize: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                </div>
                <div className="field">
                  <label>最大字号：{cfg.maxFontSize}px</label>
                  <input type="range" min={cfg.minFontSize} max="40" step="1" value={cfg.maxFontSize}
                    onChange={(e) => set({ maxFontSize: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                </div>
                <div className="field">
                  <label>滚动速度：{cfg.speed} px/s</label>
                  <input type="range" min="20" max="260" step="10" value={cfg.speed}
                    onChange={(e) => set({ speed: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  <span className="hint">越小越慢，建议 50-90</span>
                </div>
                <div className="field">
                  <label>轨道数：{cfg.lanes}</label>
                  <input type="range" min="3" max="16" step="1" value={cfg.lanes}
                    onChange={(e) => set({ lanes: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  <span className="hint">纵向分几行滚动，越多越密</span>
                </div>
                <div className="field">
                  <label>同屏上限：{cfg.maxOnScreen}</label>
                  <input type="range" min="4" max="60" step="1" value={cfg.maxOnScreen}
                    onChange={(e) => set({ maxOnScreen: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                </div>
                <div className="field">
                  <label>点击停留：{cfg.pauseSeconds} 秒</label>
                  <input type="range" min="1" max="30" step="1" value={cfg.pauseSeconds}
                    onChange={(e) => set({ pauseSeconds: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  <span className="hint">鼠标悬停或点击后暂停的时长</span>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={!!cfg.showMood} onChange={(e) => set({ showMood: e.target.checked })} />
                在弹幕上显示心情标签
              </label>
            </div>
          </div>
        </div>

        {/* 预览 */}
        <div className="panel" style={{ position: 'sticky', top: 0 }}>
          <div className="panel__head"><h3>预览</h3></div>
          <div className="panel__body">
            <div style={{ position: 'relative', height: 220, borderRadius: 10, background: 'var(--bg-panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              {['这是一条示例留言', '你好呀', '写得真好', '来看看', '收藏了', '继续加油'].map((t, i) => {
                const size = cfg.minFontSize + Math.random() * Math.max(0, cfg.maxFontSize - cfg.minFontSize);
                const color = cfg.colors[i % cfg.colors.length];
                return (
                  <span key={i} style={{
                    position: 'absolute',
                    top: `${(i * (220 / 8)) + 8}px`,
                    left: `${(i * 27) % 60}%`,
                    fontSize: `${size}px`,
                    color,
                    whiteSpace: 'nowrap',
                    opacity: 0.92,
                  }}>{t}</span>
                );
              })}
            </div>
            <p className="faint" style={{ margin: '12px 0 0', fontSize: '0.78rem' }}>
              这是静态示意，实际效果请到前台「留言墙」查看。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
