import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

const SECTIONS = [
  { key: 'frontend', label: '基本信息' },
  { key: 'theme', label: '主题外观' },
  { key: 'themeColors', label: '配色方案' },
  { key: 'nav', label: '导航菜单' },
  { key: 'social', label: '社交链接' },
  { key: 'plugins', label: '功能开关' },
  { key: 'features', label: '功能参数', hidden: true },
];

export default function Settings() {
  const [state, setState] = useState(null);
  const [section, setSection] = useState('frontend');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get('/admin/settings')
    .then(({ data }) => {
      const merged = {};
      for (const s of SECTIONS) merged[s.key] = { ...(data.defaults[s.key] || {}), ...(data.overrides[s.key] || {}) };
      // 「功能开关」页同时管理 plugins 与 features（注册开关在 features 里）
      merged.plugins = {
        ...merged.plugins,
        allowRegistration: (data.overrides.features || data.defaults.features)?.allowRegistration === true,
      };
      setState({ defaults: data.defaults, overrides: data.overrides, merged });
      setDraft(deepClone(merged[section] || {}));
    })
    .catch((e) => toast.error(e.message));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (state) setDraft(deepClone(state.merged[section] || {}));
  }, [section, state]);

  const save = async () => {
    setBusy(true);
    try {
      if (section === 'plugins') {
        // 拆分成 plugins / features 两个分区保存
        const { allowRegistration, ...pluginFlags } = draft;
        await api.put('/admin/settings/plugins', { value: pluginFlags });
        const feat = { ...(state.merged.features || {}), allowRegistration: allowRegistration === true };
        await api.put('/admin/settings/features', { value: feat });
      } else {
        await api.put(`/admin/settings/${section}`, { value: draft });
      }
      toast.toast('设置已保存，前台刷新后生效');
      // 通知主题层重新拉取站点默认，让后台预览立刻反映改动
      window.dispatchEvent(new Event('pblog:site-updated'));
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const resetSection = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/settings/${section}`);
      toast.toast('已恢复为配置文件默认值');
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!state || !draft) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;

  const isOverridden = !!state.overrides[section];

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>站点设置</h2>
          <p>这里保存的设置会写入数据库并覆盖 PBLOG.json 中的默认值</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetSection} disabled={busy || !isOverridden}>恢复默认</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存设置
          </button>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.filter((s) => !s.hidden).map((s) => (
            <button key={s.key} className={section === s.key ? 'is-active' : ''} onClick={() => setSection(s.key)}>
              {s.label}{state.overrides[s.key] ? ' ·' : ''}
            </button>
          ))}
        </nav>

        <div className="panel">
          <div className="panel__head">
            <h3>{SECTIONS.find((s) => s.key === section)?.label}</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.76rem', color: isOverridden ? 'var(--accent)' : 'var(--text-faint)' }}>
              {isOverridden ? '已由数据库覆盖' : '使用配置文件默认值'}
            </span>
          </div>
          <div className="panel__body">
            {section === 'frontend' && <FrontendForm draft={draft} setDraft={setDraft} />}
            {section === 'theme' && <ThemeForm draft={draft} setDraft={setDraft} />}
            {section === 'themeColors' && <ColorForm draft={draft} setDraft={setDraft} />}
            {section === 'nav' && <ListForm draft={draft} setDraft={setDraft} fields={[['label', '显示名称'], ['to', '路径 / 链接']]} title="导航项" />}
            {section === 'social' && <ListForm draft={draft} setDraft={setDraft} fields={[['label', '名称'], ['href', '链接']]} title="社交链接" />}
            {section === 'plugins' && <PluginsForm draft={draft} setDraft={setDraft} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function deepClone(o) { return JSON.parse(JSON.stringify(o || {})); }

function Field({ label, hint, children, full }) {
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function FrontendForm({ draft, setDraft }) {
  const upd = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <div className="form-grid">
      <Field label="站点标题"><input className="input" value={draft.title || ''} onChange={upd('title')} /></Field>
      <Field label="副标题（Logo 下方小字）"><input className="input" value={draft.subtitle || ''} onChange={upd('subtitle')} /></Field>
      <Field label="Logo 文字"><input className="input" value={draft.logoText || ''} onChange={upd('logoText')} /></Field>
      <Field label="Logo 图片地址"><input className="input" value={draft.logoImage || ''} onChange={upd('logoImage')} placeholder="留空则使用内置图形" /></Field>
      <Field label="站点描述" full><input className="input" value={draft.description || ''} onChange={upd('description')} /></Field>
      <Field label="作者"><input className="input" value={draft.author || ''} onChange={upd('author')} /></Field>
      <Field label="头像地址"><input className="input" value={draft.avatar || ''} onChange={upd('avatar')} /></Field>
      <Field label="作者简介" full>
        <textarea className="textarea" rows={3} value={draft.authorBio || ''} onChange={upd('authorBio')} />
      </Field>
      <Field label="页脚文字" hint="支持 {year} 占位符" full>
        <input className="input" value={draft.footerText || ''} onChange={upd('footerText')} />
      </Field>
      <Field label="ICP 备案号"><input className="input" value={draft.icp || ''} onChange={upd('icp')} /></Field>
      <Field label="每页文章数">
        <input className="input" type="number" min="1" max="50" value={draft.postsPerPage || 8}
          onChange={(e) => setDraft({ ...draft, postsPerPage: Number(e.target.value) })} />
      </Field>
      <Field label="Favicon 地址" full><input className="input" value={draft.favicon || ''} onChange={upd('favicon')} /></Field>
    </div>
  );
}

/* 界面风格：与前台 web/src/lib/theme.js 的 SKINS 保持一致。
   这里复制一份是为了让管理端构建不依赖前台源码（两端独立打包）。 */
const ADMIN_SKINS = [
  { key: 'classic',  label: '原有风格', desc: '扁平、克制，不加修饰' },
  { key: 'acrylic',  label: '亚克力',   desc: '磨砂半透明，Windows 质感', platform: 'Windows' },
  { key: 'liquid',   label: '液态玻璃', desc: '通透流动，大圆角高光', platform: 'iOS' },
  { key: 'material', label: 'Material', desc: '色阶分层，层次分明', platform: 'Android' },
];

const SKIN_PRESETS = {
  classic:  { mode: 'dark',  accent: null,      accentSoft: null,      radius: 16 },
  acrylic:  { mode: 'dark',  accent: '#4aa3ff', accentSoft: '#2b7fd4', radius: 12 },
  liquid:   { mode: 'dark',  accent: '#7cc7ff', accentSoft: '#4f9fe0', radius: 20 },
  material: { mode: 'light', accent: '#6750a4', accentSoft: '#7f67be', radius: 16 },
};

function ThemeForm({ draft, setDraft }) {
  const locked = !!draft.skinLocked;

  /* 切换站点默认风格：同时套用该风格的推荐明暗/配色/圆角，
     省得管理员还要手动配一遍。管理员之后仍可单独改任意一项。 */
  const pickSkin = (key) => {
    const preset = SKIN_PRESETS[key] || {};
    setDraft({
      ...draft,
      skin: key,
      ...(preset.mode !== undefined ? { mode: preset.mode } : {}),
      ...(preset.accent !== undefined ? { accent: preset.accent } : {}),
      ...(preset.accentSoft !== undefined ? { accentSoft: preset.accentSoft } : {}),
      ...(preset.radius !== undefined ? { radius: preset.radius } : {}),
    });
  };

  return (
    <div>
      <p className="faint" style={{ marginTop: 0, fontSize: '0.84rem' }}>
        以下为「匿名访客」看到的默认外观。已登录用户若在个人中心保存过自己的偏好，则优先使用其个人设置。
      </p>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel__head">
          <h3>界面风格</h3>
          <label className="switch" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setDraft({ ...draft, skinLocked: e.target.checked })}
            />
            锁定风格（不允许前台修改）
          </label>
        </div>
        <div className="panel__body">
          <p className="faint" style={{ marginTop: 0, marginBottom: 12, fontSize: '0.82rem' }}>
            决定卡片、按钮、顶栏、输入框的材质质感。风格只控制「质感层」，
            与下方配色相互独立：换风格会套用配套的推荐配色，但管理员随时可以单独调色。
            {locked && <strong style={{ color: 'var(--accent)' }}> 当前已锁定，前台用户无法切换。</strong>}
          </p>

          <div className="skin-admin-grid">
            {ADMIN_SKINS.map((sk) => {
              const on = (draft.skin || 'classic') === sk.key;
              return (
                <button
                  key={sk.key}
                  type="button"
                  className={`skin-admin-card${on ? ' is-active' : ''}`}
                  onClick={() => pickSkin(sk.key)}
                >
                  <span className={`skin-admin-preview skin-admin-preview--${sk.key}`} aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <span className="skin-admin-meta">
                    <strong>{sk.label}</strong>
                    {sk.platform && <em>{sk.platform}</em>}
                    <small>{sk.desc}</small>
                  </span>
                  {on && <span className="skin-admin-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <Field label="默认主题模式">
          <select className="select" value={draft.mode || 'dark'} onChange={(e) => setDraft({ ...draft, mode: e.target.value })}>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </Field>

        <Field label="默认强调色">
          <div className="color-row">
            <input type="color" value={draft.accent || '#6ee7b7'} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} />
            <input className="input" value={draft.accent || ''} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} />
          </div>
        </Field>

        <Field label="强调色渐变端">
          <div className="color-row">
            <input type="color" value={draft.accentSoft || '#34d399'} onChange={(e) => setDraft({ ...draft, accentSoft: e.target.value })} />
            <input className="input" value={draft.accentSoft || ''} onChange={(e) => setDraft({ ...draft, accentSoft: e.target.value })} />
          </div>
        </Field>

        <Field label="圆角（px）" hint="与前台「外观设置」中的圆角一致">
          <input
            className="input" type="number" min="0" max="28" value={draft.radius ?? 16}
            onChange={(e) => setDraft({ ...draft, radius: Number(e.target.value) })}
          />
        </Field>

        <Field label="阅读宽度（px）" hint="文章正文最大宽度，建议 680-780">
          <input
            className="input" type="number" min="600" max="900" step="20" value={draft.readingWidth ?? 720}
            onChange={(e) => setDraft({ ...draft, readingWidth: Number(e.target.value) })}
          />
        </Field>

        <Field label="默认字号">
          <select className="select" value={draft.fontSize || 'md'} onChange={(e) => setDraft({ ...draft, fontSize: e.target.value })}>
            <option value="sm">小</option>
            <option value="md">标准</option>
            <option value="lg">大</option>
          </select>
        </Field>

        <Field label="正文字体" full>
          <input className="input" value={draft.fontFamily || ''} onChange={(e) => setDraft({ ...draft, fontFamily: e.target.value })} />
        </Field>

        <Field label="等宽字体" full>
          <input className="input" value={draft.monoFontFamily || ''} onChange={(e) => setDraft({ ...draft, monoFontFamily: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function ColorForm({ draft, setDraft }) {
  const entries = Object.entries(draft || {});
  const update = (name, patch) => {
    setDraft({ ...draft, [name]: { ...draft[name], ...patch } });
  };
  const rename = (oldName, newName) => {
    if (!newName || newName === oldName) return;
    const next = {};
    for (const [k, v] of Object.entries(draft)) next[k === oldName ? newName : k] = v;
    setDraft(next);
  };
  const add = () => setDraft({ ...draft, ['配色 ' + (entries.length + 1)]: { accent: '#818cf8', accentSoft: '#6366f1' } });
  const remove = (name) => {
    const next = { ...draft };
    delete next[name];
    setDraft(next);
  };
  return (
    <div>
      <p className="faint" style={{ marginTop: 0, fontSize: '0.84rem' }}>这些配色会出现在前台「外观设置」面板中，供访客切换。</p>
      {entries.map(([name, val]) => (
        <div key={name} className="kv-row" style={{ gridTemplateColumns: '1fr 130px 130px auto' }}>
          <input className="input" defaultValue={name} onBlur={(e) => rename(name, e.target.value)} />
          <div className="color-row">
            <input type="color" value={val.accent || '#818cf8'} onChange={(e) => update(name, { accent: e.target.value })} />
            <input className="input" value={val.accent || ''} onChange={(e) => update(name, { accent: e.target.value })} />
          </div>
          <div className="color-row">
            <input type="color" value={val.accentSoft || val.accent || '#6366f1'} onChange={(e) => update(name, { accentSoft: e.target.value })} />
            <input className="input" value={val.accentSoft || ''} onChange={(e) => update(name, { accentSoft: e.target.value })} />
          </div>
          <button className="icon-btn icon-btn--danger" onClick={() => remove(name)} title="删除"><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <button className="btn btn--sm" style={{ marginTop: 10 }} onClick={add}><Icon name="plus" size={14} />添加配色</button>
    </div>
  );
}

function ListForm({ draft, setDraft, fields, title }) {
  const list = Array.isArray(draft) ? draft : [];
  const update = (i, key, value) => {
    const next = list.slice();
    next[i] = { ...next[i], [key]: value };
    setDraft(next);
  };
  return (
    <div>
      {list.map((item, i) => (
        <div key={i} className="kv-row" style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr) auto` }}>
          {fields.map(([key, label]) => (
            <input key={key} className="input" placeholder={label} value={item[key] || ''} onChange={(e) => update(i, key, e.target.value)} />
          ))}
          <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setDraft(list.filter((_, j) => j !== i))}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      {!list.length && <p className="faint">暂无{title}</p>}
      <button
        className="btn btn--sm" style={{ marginTop: 10 }}
        onClick={() => setDraft([...list, Object.fromEntries(fields.map(([k, l]) => [k, l === '路径 / 链接' ? '/' : '']))])}
      >
        <Icon name="plus" size={14} />添加{title}
      </button>
    </div>
  );
}

const PLUGIN_LABELS = {
  comments: '评论系统', search: '搜索', viewCounter: '阅读统计', tableOfContents: '文章目录',
  readingTime: '阅读时长', backToTop: '回到顶部', rss: 'RSS 订阅', sitemap: '站点地图', likes: '点赞',
  chat: '聊天室', guestbook: '留言墙', music: '音乐播放器', member: '访客登录/注册',
};

function PluginsForm({ draft, setDraft }) {
  return (
    <div>
      <div style={{ display: 'grid', gap: 12 }}>
        {Object.keys(PLUGIN_LABELS).map((key) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={draft[key] !== false}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
            />
            {PLUGIN_LABELS[key]}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={draft.allowRegistration === true}
            onChange={(e) => setDraft({ ...draft, allowRegistration: e.target.checked })}
          />
          开放访客注册
        </label>
        <p className="hint" style={{ marginLeft: 26, marginTop: 4 }}>
          关闭后前台无法注册新账号，但已有账号仍可登录。
        </p>
      </div>
    </div>
  );
}
