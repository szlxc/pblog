import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

/** 根据配置生成网易云外链播放器地址 */
function buildEmbed(c) {
  const id = (c?.playlistId || c?.songId || '').trim();
  if (!id) return '';
  const type = c?.playlistId ? 0 : 2;
  return `https://music.163.com/outchain/player?type=${type}&id=${encodeURIComponent(id)}&auto=${c?.autoPlay ? 1 : 0}&height=86`;
}

/**
 * 网易云音乐外链播放器配置
 * 歌单 ID 提取：打开歌单页 URL 里的 id 参数
 *   https://music.163.com/playlist?id=123456789  → 123456789
 * 单曲 ID：https://music.163.com/song?id=987654 → 987654
 */
export default function MusicSettings() {
  const [cfg, setCfg] = useState(null);
  const [previewSrc, setPreviewSrc] = useState('');   // 已确认的预览（点按钮才更新，避免输入时 iframe 反复加载卡顿）
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/admin/music-config').then(({ data }) => {
      setCfg(data);
      setPreviewSrc(buildEmbed(data));
    }).catch((e) => toast.error(e.message));
  }, [toast]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/music-config', cfg);
      setPreviewSrc(buildEmbed(cfg));   // 保存后顺便刷新预览
      toast.toast('已保存，前台刷新后生效');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  // 仅点「预览」按钮时用于更新 iframe src
  const applyPreview = () => setPreviewSrc(buildEmbed(cfg));

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>音乐播放器</h2>
          <p>使用网易云官方外链播放器，无需 API，填歌单或歌曲 ID 即可</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel__head"><h3>配置</h3><span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-faint)' }}>无需重启</span></div>
          <div className="panel__body">
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              在前台显示音乐播放器（右下角可折叠小窗）
            </label>

            <div className="form-grid">
              <div className="field field--full">
                <label>歌单 ID</label>
                <input
                  className="input" value={cfg.playlistId || ''}
                  onChange={(e) => set({ playlistId: e.target.value.trim() })}
                  placeholder="例如 2884035"
                />
                <span className="hint">从 https://music.163.com/playlist?id=<b>2884035</b> 里取 id</span>
              </div>
              <div className="field">
                <label>单曲 ID（与歌单二选一，歌单优先）</label>
                <input
                  className="input" value={cfg.songId || ''}
                  onChange={(e) => set({ songId: e.target.value.trim() })}
                  placeholder="例如 1901371647"
                />
              </div>
              <div className="field">
                <label>主题色</label>
                <div className="color-row">
                  <input type="color" value={cfg.theme || '#6ee7b7'} onChange={(e) => set({ theme: e.target.value })} />
                  <input className="input" value={cfg.theme || ''} onChange={(e) => set({ theme: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={!!cfg.autoPlay} onChange={(e) => set({ autoPlay: e.target.checked })} />
                自动播放（多数浏览器会拦截，建议关闭）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={!!cfg.homeOnly} onChange={(e) => set({ homeOnly: e.target.checked })} />
                只在首页显示
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={!!cfg.defaultOpen} onChange={(e) => set({ defaultOpen: e.target.checked })} />
                默认展开（否则访客点图标才展开）
              </label>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>预览</h3>
            <button className="btn btn--sm" style={{ marginLeft: 'auto' }} onClick={applyPreview}>
              <Icon name="refresh" size={14} />预览
            </button>
          </div>
          <div className="panel__body">
            {previewSrc ? (
              <iframe
                title="预览" src={previewSrc} frameBorder="no" width="100%" height="86"
                style={{ borderRadius: 10, background: 'var(--bg-panel)' }}
              />
            ) : (
              <p className="faint" style={{ margin: 0 }}>填写歌单或歌曲 ID，点预览查看</p>
            )}
            <div style={{ marginTop: 16, fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 8px' }}><strong>说明</strong></p>
              <p style={{ margin: 0 }}>外链播放器由网易云提供，样式固定为 66px 高度。访客需点击播放按钮才会播放音频，这是浏览器策略限制，无法绕过。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
