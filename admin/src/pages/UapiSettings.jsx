import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

/**
 * UAPI 集成配置（uapis.cn 免费公共 API 平台）
 * token 只保存在服务端，前端永远拿不到完整值。
 */
export default function UapiSettings() {
  const [cfg, setCfg] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();

  const load = () => api.get('/admin/uapi-config')
    .then(({ data }) => setCfg(data))
    .catch((e) => toast.error(e.message));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...cfg };
      if (tokenInput.trim()) payload.token = tokenInput.trim();
      delete payload.tokenMasked;
      delete payload.hasToken;
      await api.put('/admin/uapi-config', payload);
      setTokenInput('');
      setResult(null);
      await load();
      toast.toast('已保存，前台刷新后生效');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await api.post('/admin/uapi-test');
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setFeature = (k, v) => setCfg((c) => ({ ...c, features: { ...c.features, [k]: v } }));

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>UAPI 集成</h2>
          <p>接入 uapis.cn 的免费公共 API，为站点提供每日壁纸、一言等内容</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {/* 连接 */}
          <div className="panel">
            <div className="panel__head"><h3>API 凭据</h3></div>
            <div className="panel__body">
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                启用 UAPI 集成
              </label>

              <div className="field">
                <label>API Token</label>
                <input
                  className="input"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={cfg.hasToken ? `已配置：${cfg.tokenMasked}（留空则不修改）` : 'uapi-xxxxxxxx'}
                  autoComplete="off"
                />
                <span className="hint">
                  Token 只保存在服务端数据库，前端与浏览器都拿不到。
                  {cfg.hasToken && ' 留空表示保持现有 token 不变。'}
                </span>
              </div>
            </div>
          </div>

          {/* 功能开关 */}
          <div className="panel">
            <div className="panel__head"><h3>功能模块</h3></div>
            <div className="panel__body">
              <div style={{ display: 'grid', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox" style={{ marginTop: 3 }}
                    checked={!!cfg.features.bingWallpaper}
                    onChange={(e) => setFeature('bingWallpaper', e.target.checked)}
                  />
                  <span>
                    <strong>每日壁纸</strong>
                    <br />
                    <span className="faint" style={{ fontSize: '0.8rem' }}>
                      首页侧栏显示必应每日壁纸，点击可看大图
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox" style={{ marginTop: 3 }}
                    checked={!!cfg.features.saying}
                    onChange={(e) => setFeature('saying', e.target.checked)}
                  />
                  <span>
                    <strong>一言</strong>
                    <br />
                    <span className="faint" style={{ fontSize: '0.8rem' }}>
                      首页标题下方显示一句随机诗词 / 台词
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox" style={{ marginTop: 3 }}
                    checked={!!cfg.features.hotboard}
                    onChange={(e) => setFeature('hotboard', e.target.checked)}
                  />
                  <span>
                    <strong>全网热榜</strong>
                    <br />
                    <span className="faint" style={{ fontSize: '0.8rem' }}>
                      聚合微博、知乎、B站等平台的热榜（接口已就绪，前台展示位待启用）
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox" style={{ marginTop: 3 }}
                    checked={!!cfg.features.weather}
                    onChange={(e) => setFeature('weather', e.target.checked)}
                  />
                  <span>
                    <strong>天气</strong>
                    <br />
                    <span className="faint" style={{ fontSize: '0.8rem' }}>
                      可在侧栏显示当前城市天气（接口已就绪）
                    </span>
                  </span>
                </label>
              </div>

              <div className="form-grid" style={{ marginTop: 18 }}>
                <div className="field">
                  <label>默认热榜平台</label>
                  <select
                    className="select"
                    value={cfg.hotboardType || 'zhihu'}
                    onChange={(e) => set({ hotboardType: e.target.value })}
                  >
                    {[
                      ['zhihu', '知乎'], ['weibo', '微博'], ['bilibili', 'B站'],
                      ['douyin', '抖音'], ['toutiao', '今日头条'], ['v2ex', 'V2EX'],
                      ['juejin', '掘金'], ['sspai', '少数派'], ['36kr', '36氪'],
                    ].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>默认城市（天气）</label>
                  <input
                    className="input"
                    value={cfg.city || ''}
                    onChange={(e) => set({ city: e.target.value })}
                    placeholder="北京"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 测试与说明 */}
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel">
            <div className="panel__head"><h3>连接测试</h3></div>
            <div className="panel__body">
              <button className="btn btn--block" onClick={test} disabled={testing}>
                {testing ? <span className="spinner" /> : <Icon name="refresh" size={14} />}
                测试连接
              </button>
              {result && (
                <div style={{ marginTop: 14, fontSize: '0.84rem' }}>
                  <p style={{ margin: '0 0 8px', color: result.ok ? 'var(--ok)' : 'var(--danger)' }}>
                    {result.ok ? '✓ 连接正常' : `✗ ${result.message || '失败'}`}
                  </p>
                  {result.saying && (
                    <p className="faint" style={{ margin: '0 0 6px' }}>
                      一言示例：{result.saying}
                    </p>
                  )}
                  {result.wallpaper && (
                    <p className="faint" style={{ margin: 0 }}>
                      壁纸：{result.wallpaper}
                    </p>
                  )}
                </div>
              )}
              <p className="faint" style={{ fontSize: '0.76rem', margin: '14px 0 0' }}>
                保存 token 后点击测试，能拿到一言和壁纸即为正常。
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>说明</h3></div>
            <div className="panel__body" style={{ fontSize: '0.82rem', lineHeight: 1.8, color: 'var(--text-dim)' }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong>UApiPro</strong> 是一个免费公共 API 平台，提供 100+ 接口：
                网络工具、图像处理、文本转换、翻译、社交查询、天气、热榜等。
              </p>
              <p style={{ margin: '0 0 10px' }}>
                所有请求由服务器代理转发，token 不会暴露给访客。
                结果会在服务端缓存（壁纸 30 分钟、一言 1 分钟），避免浪费额度。
              </p>
              <p style={{ margin: 0 }}>
                API 不可用时会静默降级，不影响博客正常访问。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
