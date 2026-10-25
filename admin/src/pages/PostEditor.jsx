import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

const EMPTY = {
  title: '', slug: '', summary: '', content: '', contentFormat: 'markdown',
  coverImage: '', categoryId: '', status: 'draft', isPinned: false, isFeatured: false,
  allowComment: true, seoTitle: '', seoDescription: '', tags: [], publishedAt: '',
};

const TICK = String.fromCharCode(96);
const FENCE = TICK + TICK + TICK;

// 新文章预填的示例内容（用字符串拼接避免模板字面量嵌套反引号）
const DEMO = [
  '## 从这里开始',
  '',
  '写下你的想法。支持 **粗体**、*斜体*、' + TICK + '行内代码' + TICK + '、[链接](https://example.com)，以及：',
  '',
  '- 无序列表',
  '- [ ] 任务清单',
  '- [x] 已完成项',
  '',
  '> 引用会显示为左侧竖线样式。',
  '',
  FENCE + 'js',
  '// 代码块带高亮与复制按钮',
  'const hello = (name) => "你好，" + name;',
  FENCE,
  '',
  '| 列一 | 列二 |',
  '| --- | --- |',
  '| 内容 | 内容 |',
].join('\n');

/** 客户端轻量 Markdown 预览（管理员可信内容，不做清洗） */
function renderPreview(md) {
  let s = String(md || '').replace(/\r\n?/g, '\n');
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  s = esc(s);
  const blocks = [];
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<figure class="code-block"><figcaption>${lang}</figcaption><pre><code>${code}</code></pre></figure>`);
    return `\u0000B${blocks.length - 1}\u0000`;
  });
  s = s.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>');
  s = s.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/^(\s*)[-*+] (.*)$/gm, (m, sp, t) => {
    const task = t.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) return `${sp}<li class="task" data-done="${task[1] !== ' '}">${task[1] !== ' ' ? '☑' : '☐'} ${task[2]}</li>`;
    return `${sp}<li>${t}</li>`;
  });
  s = s.replace(/(<li[^>]*>[\s\S]*?<\/li>)(?!\s*<li)/g, '<ul>$1</ul>');
  s = s.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  s = s.replace(/^---+$/gm, '<hr>');
  s = s.replace(/\n((?:\|.*\|\n)+)/g, (m, table) => {
    const rows = table.trim().split('\n').map((r) => r.replace(/^\||\|$/g, '').split('|'));
    if (rows.length < 2) return m;
    const head = rows[0].map((c) => `<th>${c.trim()}</th>`).join('');
    const body = rows.slice(2).map((r) => `<tr>${r.map((c) => `<td>${c.trim()}</td>`).join('')}</tr>`).join('');
    return `\n<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
  });
  s = s.split(/\n{2,}/).map((para) => {
    const t = para.trim();
    if (!t) return '';
    if (/^<(h\d|ul|ol|blockquote|figure|div|hr|p)/.test(t) || /^\u0000B\d+\u0000$/.test(t)) return t;
    return `<p>${t.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  s = s.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  return s;
}

const wordCount = (text) => {
  const plain = String(text || '').replace(/```[\s\S]*?```/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (plain.match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + en;
};

export default function PostEditor() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(() => ({ ...EMPTY, content: DEMO }));
  const [tagInput, setTagInput] = useState('');
  const [cats, setCats] = useState([]);
  const [tab, setTab] = useState('write');
  const [split, setSplit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [uploadPct, setUploadPct] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(() => {
    api.get('/admin/categories').then(({ data }) => setCats(data || [])).catch(() => {});
    api.get('/admin/tags').then(({ data }) => setAllTags(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api.get('/admin/posts/' + id)
      .then(({ data }) => {
        setForm({
          title: data.title || '', slug: data.slug || '', summary: data.summary || '',
          content: data.content || '', contentFormat: data.content_format || 'markdown',
          coverImage: data.cover_image || '',
          categoryId: data.category_id ? String(data.category_id) : '',
          status: data.status || 'draft', isPinned: !!data.is_pinned, isFeatured: !!data.is_featured,
          allowComment: !!data.allow_comment, seoTitle: data.seo_title || '',
          seoDescription: data.seo_description || '',
          tags: (data.tags || []).map((t) => t.name),
          publishedAt: data.published_at ? new Date(data.published_at).toISOString().slice(0, 16) : '',
        });
        setDirty(false);
      })
      .catch((e) => { toast.error(e.message); navigate('/posts'); })
      .finally(() => setLoading(false));
  }, [editing, id, navigate, toast]);

  useEffect(() => {
    const onBeforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  const insert = useCallback((before, after = '', placeholder = '') => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    set({ content: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }, []);

  const save = async (forceStatus) => {
    if (!form.title.trim()) { toast.error('请填写标题'); return; }
    if (!form.content.trim()) { toast.error('正文不能为空'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        summary: form.summary || undefined,
        content: form.content,
        contentFormat: form.contentFormat,
        coverImage: form.coverImage || undefined,
        categoryId: form.categoryId || null,
        status: forceStatus || form.status,
        isPinned: form.isPinned,
        isFeatured: form.isFeatured,
        allowComment: form.allowComment,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        tags: form.tags,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
      };
      if (editing) {
        await api.put('/admin/posts/' + id, payload);
        toast.toast('已保存');
        setDirty(false);
        setForm((f) => ({ ...f, status: payload.status }));
      } else {
        const res = await api.post('/admin/posts', payload);
        toast.toast('已创建');
        setDirty(false);
        navigate('/posts/' + res.id, { replace: true });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = save;

  const onUpload = async (file) => {
    if (!file) return;
    setUploadPct(0);
    try {
      const res = await api.upload(file, setUploadPct);
      insert('![' + file.name.replace(/\.[^.]+$/, '') + '](' + res.url + ')');
      toast.toast('图片已插入');
    } catch (e) { toast.error(e.message); } finally { setUploadPct(null); }
  };

  const addTag = (name) => {
    const n = String(name || '').trim();
    if (!n || form.tags.includes(n)) return;
    set({ tags: [...form.tags, n].slice(0, 20) });
    setTagInput('');
  };

  const previewHtml = useMemo(
    () => (form.contentFormat === 'html' ? form.content : renderPreview(form.content)),
    [form.content, form.contentFormat]
  );

  const words = wordCount(form.content);

  if (loading) {
    return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;
  }

  const tools = [
    ['H2', () => insert('## ', '', '标题')],
    ['B', () => insert('**', '**', '粗体')],
    ['I', () => insert('*', '*', '斜体')],
    ['S', () => insert('~~', '~~', '删除线')],
    ['code', () => insert(TICK, TICK, 'code')],
    ['链接', () => insert('[', '](https://)', '链接文字')],
    ['引用', () => insert('> ', '', '引用内容')],
    ['代码块', () => insert(FENCE + 'js\n', '\n' + FENCE, '// code')],
    ['列表', () => insert('- ', '', '列表项')],
    ['任务', () => insert('- [ ] ', '', '待办')],
    ['表格', () => insert('| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n')],
    ['分割线', () => insert('\n---\n')],
  ];

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>{editing ? '编辑文章' : '写文章'}</h2>
          <p>{dirty ? '有未保存的修改' : '所有修改已保存'} · Ctrl/⌘ + S 快速保存</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/posts')}>返回列表</button>
          {editing && form.slug ? (
            <a className="btn" target="_blank" rel="noopener noreferrer" href={api.base + '/post/' + encodeURIComponent(form.slug)}>
              <Icon name="eye" size={15} />预览前台
            </a>
          ) : null}
          <button className="btn" onClick={() => save('draft')} disabled={saving}>存草稿</button>
          <button className="btn btn--primary" onClick={() => save('published')} disabled={saving}>
            {saving ? <span className="spinner" /> : <Icon name="check" size={15} />}发布
          </button>
        </div>
      </div>

      <div className="editor-page">
        <div className="editor-main">
          <input
            className="editor-title" placeholder="文章标题…"
            value={form.title} onChange={(e) => set({ title: e.target.value })}
          />

          <div className="panel">
            <div className="editor-tabs">
              <button className={'editor-tab' + (tab === 'write' ? ' is-active' : '')} onClick={() => setTab('write')}>编辑</button>
              <button className={'editor-tab' + (tab === 'preview' ? ' is-active' : '')} onClick={() => setTab('preview')}>预览</button>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  格式
                  <select
                    className="select" style={{ width: 'auto', padding: '3px 8px', fontSize: '0.78rem' }}
                    value={form.contentFormat} onChange={(e) => set({ contentFormat: e.target.value })}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                  </select>
                </label>
                {tab === 'write' && (
                  <button className="btn btn--sm btn--ghost" onClick={() => setSplit((v) => !v)}>
                    {split ? '关闭分屏' : '分屏预览'}
                  </button>
                )}
              </div>
            </div>

            {tab === 'write' && (
              <>
                <div className="editor-toolbar">
                  {tools.map(([label, fn]) => (
                    <button key={label} type="button" onClick={fn} title={label}>{label}</button>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()} title="上传图片">图片</button>
                  <input
                    ref={fileRef} type="file" accept="image/*" hidden
                    onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }}
                  />
                  {uploadPct !== null && <span style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>上传 {uploadPct}%</span>}
                </div>
                <div className={split ? 'editor-split' : ''}>
                  <textarea
                    ref={taRef}
                    className="editor-textarea"
                    value={form.content}
                    onChange={(e) => set({ content: e.target.value })}
                    onDrop={(e) => {
                      const f = e.dataTransfer.files?.[0];
                      if (f && f.type.startsWith('image/')) { e.preventDefault(); onUpload(f); }
                    }}
                    spellCheck={false}
                    placeholder="开始写…"
                  />
                  {split && (
                    <div className="editor-preview md-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  )}
                </div>
              </>
            )}

            {tab === 'preview' && (
              <div className="editor-preview md-preview" style={{ maxHeight: 'none' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}

            <div className="editor-stats">
              <span>{words} 字</span>
              <span>约 {Math.max(1, Math.round(words / 300))} 分钟阅读</span>
              <span>{form.tags.length} 个标签</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>摘要</h3></div>
            <div className="panel__body">
              <textarea
                className="textarea" rows={3} maxLength={500}
                value={form.summary} onChange={(e) => set({ summary: e.target.value })}
                placeholder="留空则自动从正文截取前 160 字"
              />
            </div>
          </div>
        </div>

        <aside className="editor-side">
          <div className="panel">
            <div className="panel__head"><h3>发布设置</h3></div>
            <div className="panel__body">
              <div className="field">
                <label>状态</label>
                <select className="select" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="scheduled">定时发布</option>
                  <option value="private">私密</option>
                </select>
              </div>
              <div className="field">
                <label>发布时间</label>
                <input
                  className="input" type="datetime-local" value={form.publishedAt}
                  onChange={(e) => set({ publishedAt: e.target.value })}
                />
                <span className="hint">留空则发布时自动取当前时间</span>
              </div>
              <div className="field">
                <label>分类</label>
                <select className="select" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">未分类</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>别名（URL）</label>
                <input
                  className="input" value={form.slug}
                  onChange={(e) => set({ slug: e.target.value })}
                  placeholder="留空自动根据标题生成"
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', marginBottom: 8 }}>
                <input type="checkbox" checked={form.isPinned} onChange={(e) => set({ isPinned: e.target.checked })} />
                置顶文章
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', marginBottom: 8 }}>
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} />
                首页推荐
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
                <input type="checkbox" checked={form.allowComment} onChange={(e) => set({ allowComment: e.target.checked })} />
                允许评论
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>标签</h3></div>
            <div className="panel__body">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {form.tags.map((t) => (
                  <span
                    key={t}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: '0.78rem' }}
                  >
                    {t}
                    <button onClick={() => set({ tags: form.tags.filter((x) => x !== t) })} aria-label={'移除 ' + t}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
                {!form.tags.length && <span className="faint" style={{ fontSize: '0.8rem' }}>尚未添加标签</span>}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addTag(tagInput); }} style={{ display: 'flex', gap: 6 }}>
                <input className="input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="输入后回车添加" list="tag-suggest" />
                <datalist id="tag-suggest">
                  {allTags.map((t) => <option key={t.id} value={t.name} />)}
                </datalist>
                <button className="btn" type="submit">添加</button>
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>封面图</h3></div>
            <div className="panel__body">
              {form.coverImage ? (
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <img src={form.coverImage} alt="封面预览" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                  <button className="btn btn--sm btn--danger" style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => set({ coverImage: '' })}>
                    移除
                  </button>
                </div>
              ) : null}
              <input
                className="input" placeholder="图片地址 https://…"
                value={form.coverImage} onChange={(e) => set({ coverImage: e.target.value })}
              />
              <label className="btn btn--sm btn--block" style={{ marginTop: 8 }}>
                <Icon name="upload" size={14} />上传封面
                <input
                  type="file" accept="image/*" hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadPct(0);
                    try {
                      const res = await api.upload(f, setUploadPct);
                      set({ coverImage: res.url });
                    } catch (err) { toast.error(err.message); } finally { setUploadPct(null); }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>SEO</h3></div>
            <div className="panel__body">
              <div className="field">
                <label>SEO 标题</label>
                <input className="input" value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} placeholder="默认使用文章标题" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>SEO 描述</label>
                <textarea className="textarea" rows={3} value={form.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} placeholder="默认使用摘要" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
