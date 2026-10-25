import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

/** 可配置的页面 */
const PAGE_LIST = [
  { key: 'home', label: '首页' },
  { key: 'post', label: '文章详情' },
  { key: 'archive', label: '归档' },
  { key: 'tags', label: '标签' },
  { key: 'chat', label: '聊天室' },
  { key: 'guestbook', label: '留言墙' },
  { key: 'profile', label: '个人中心' },
  { key: 'auth', label: '登录 / 注册' },
];

const EMPTY = { auto: false, image: '', overlay: 0.55, blur: 0, fixed: true, position: 'center' };

export default function Backgrounds() {
  const [cfg, setCfg] = useState(null);
  const [pages, setPages] = useState([]);
  const [active, setActive] = useState('__global__');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/admin/settings'),
      api.get('/admin/pages'),
    ]).then(([settings, pageList]) => {
      const stored = settings.data.overrides.backgrounds || { global: null, pages: {} };
      setCfg({
        global: stored.global ? { ...EMPTY, ...stored.global } : null,
        pages: stored.pages || {},
      });
      setPages(pageList.data || []);
    }).catch((e) => toast.error(e.message));
  }, [toast]);

  // 当前编辑项
  const current = useMemo(() => {
    if (!cfg) return EMPTY;
    if (active === '__global__') return cfg.global || EMPTY;
    return cfg.pages[active] || EMPTY;
  }, [cfg, active]);

  const setCurrent = (patch) => {
    const next = { ...current, ...patch };
    setCfg((c) => {
      if (active === '__global__') return { ...c, global: next };
      return { ...c, pages: { ...c.pages, [active]: next } };
    });
  };

  const clearCurrent = () => {
    setCfg((c) => {
      if (active === '__global__') return { ...c, global: null };
      const pages = { ...c.pages };
      delete pages[active];
      return { ...c, pages };
    });
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(1);
    try {
      const res = await api.upload(file, setUploading);
      setCurrent({ image: res.url });
      toast.toast('图片已上传');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(0);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      // 清理空配置
      const usable = (v) => v && (v.image || v.auto);
      const payload = {
        global: usable(cfg.global) ? cfg.global : null,
        pages: Object.fromEntries(Object.entries(cfg.pages).filter(([, v]) => usable(v))),
      };
      await api.put('/admin/settings/backgrounds', { value: payload });
      toast.toast('已保存，前台刷新后生效');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;

  const pageKeys = [
    ...PAGE_LIST,
    ...pages.map((p) => ({ key: `page:${p.slug}`, label: `${p.title}（独立页面）` })),
  ];

  const hasOwn = active !== '__global__' && !!(cfg.pages[active]?.image || cfg.pages[active]?.auto);

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>页面背景</h2>
          <p>为不同页面配置背景图；未单独配置的页面使用「全站默认」</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* 页面列表 */}
        <div className="panel">
          <div className="panel__head"><h3>页面</h3></div>
          <div className="panel__body" style={{ padding: 8 }}>
            <button
              className={`nav-item${active === '__global__' ? ' is-active' : ''}`}
              style={{ width: '100%' }}
              onClick={() => setActive('__global__')}
            >
              <Icon name="grid" size={16} />全站默认
            </button>
            {pageKeys.map((p) => {
              const own = !!(cfg.pages[p.key]?.image || cfg.pages[p.key]?.auto);
              return (
                <button
                  key={p.key}
                  className={`nav-item${active === p.key ? ' is-active' : ''}`}
                  style={{ width: '100%' }}
                  onClick={() => setActive(p.key)}
                >
                  <span style={{ flex: 1, textAlign: 'left' }}>{p.label}</span>
                  {own && <span className="chip chip--accent" style={{ fontSize: '0.62rem', padding: '0 6px' }}>自定义</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 配置区 */}
        <div className="panel">
          <div className="panel__head">
            <h3>{active === '__global__' ? '全站默认背景' : pageKeys.find((p) => p.key === active)?.label}</h3>
            {hasOwn && (
              <button className="btn btn--sm btn--ghost" style={{ marginLeft: 'auto' }} onClick={clearCurrent}>
                恢复默认
              </button>
            )}
          </div>
          <div className="panel__body">
            <label className="bg-auto-toggle">
              <input
                type="checkbox"
                checked={!!current.auto}
                onChange={(e) => setCurrent({ auto: e.target.checked })}
              />
              <span>
                <strong>使用 UAPI 每日壁纸</strong>
                <em>每天自动更换必应壁纸，无需自己上传。勾选后下面的自定义图不生效。</em>
              </span>
            </label>

            <div className="field">
              <label>背景图片地址</label>
              <input
                className="input"
                value={current.image || ''}
                onChange={(e) => setCurrent({ image: e.target.value })}
                placeholder="https://… 或上传"
              />
              <span className="hint">留空表示不使用背景图</span>
            </div>

            <div className="field">
              <label>上传图片</label>
              <label className="btn btn--sm" style={{ display: 'inline-flex' }}>
                <Icon name="upload" size={14} />选择图片
                <input
                  type="file" accept="image/*" hidden
                  onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
              {uploading > 0 && <span className="faint" style={{ marginLeft: 10, fontSize: '0.78rem' }}>上传 {uploading}%</span>}
            </div>

            <div className="form-grid" style={{ marginTop: 6 }}>
              <div className="field">
                <label>遮罩浓度：{Math.round((current.overlay ?? 0.55) * 100)}%</label>
                <input
                  type="range" min="0" max="100" step="5"
                  value={Math.round((current.overlay ?? 0.55) * 100)}
                  onChange={(e) => setCurrent({ overlay: Number(e.target.value) / 100 })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <span className="hint">越大文字越清晰，图片越暗</span>
              </div>

              <div className="field">
                <label>模糊：{current.blur || 0}px</label>
                <input
                  type="range" min="0" max="30" step="1"
                  value={current.blur || 0}
                  onChange={(e) => setCurrent({ blur: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              <div className="field">
                <label>背景位置</label>
                <select
                  className="select"
                  value={current.position || 'center'}
                  onChange={(e) => setCurrent({ position: e.target.value })}
                >
                  <option value="top">顶部对齐</option>
                  <option value="center">居中</option>
                  <option value="bottom">底部对齐</option>
                </select>
              </div>

              <div className="field">
                <label>&nbsp;</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={current.fixed !== false}
                    onChange={(e) => setCurrent({ fixed: e.target.checked })}
                  />
                  滚动时固定（视差）
                </label>
              </div>
            </div>

            {active !== '__global__' && !hasOwn && (
              <p className="faint" style={{ fontSize: '0.8rem', margin: '14px 0 0' }}>
                当前未单独配置；填写图片后这个页面会覆盖全站默认。
              </p>
            )}
          </div>
        </div>

        {/* 预览 */}
        <div className="panel" style={{ position: 'sticky', top: 0 }}>
          <div className="panel__head"><h3>预览</h3></div>
          <div className="panel__body">
            <div style={{
              position: 'relative',
              height: 220,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
            }}>
              {current.auto && !current.image ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.84rem', padding: 20 }}>
                  <div>
                    <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>使用每日壁纸</div>
                    <div style={{ fontSize: '0.76rem', opacity: 0.7 }}>前台会加载 UAPI 必应壁纸作为背景</div>
                  </div>
                </div>
              ) : current.image ? (
                <>
                  <div style={{
                    position: 'absolute', inset: '-3%',
                    backgroundImage: `url("${current.image}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: current.position || 'center',
                    filter: `blur(${current.blur || 0}px)`,
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `color-mix(in oklab, var(--bg) ${Math.round((current.overlay ?? 0.55) * 100)}%, transparent)`,
                  }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>折光日志</div>
                      <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: 4 }}>正文可读性预览</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: '0.84rem' }}>
                  未设置背景
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 8px' }}><strong>优先级</strong></p>
              <p style={{ margin: 0 }}>页面单独配置 &gt; 全站默认 &gt; 系统渐变</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
