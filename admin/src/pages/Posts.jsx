import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { StatusTag, Pagination, EmptyState, ConfirmDialog, TableSkeleton, useToast } from '../components/ui';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'draft', label: '草稿' },
  { key: 'scheduled', label: '定时' },
  { key: 'private', label: '私密' },
];

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export default function Posts() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const status = params.get('status') || 'all';
  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'newest';

  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState(q);
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/posts', { status, page, q, sort, pageSize: 20 });
      setRows(data);
      setMeta(m);
      setSelected([]);
    } catch (e) {
      toast.error(e.message);
      setRows([]);
    }
  }, [status, page, q, sort, toast]);

  useEffect(() => { load(); }, [load]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === null) next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allChecked = rows?.length > 0 && selected.length === rows.length;

  const doBatch = async (action) => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await api.post('/admin/posts/batch', { ids: selected, action });
      toast.toast(`已处理 ${res.affected} 篇文章`);
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const quickPatch = async (id, body) => {
    try {
      await api.patch(`/admin/posts/${id}`, body);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await api.del(`/admin/posts/${id}`);
      toast.toast('已移入回收站');
      setConfirm(null);
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>文章</h2>
          <p>管理全部文章，支持批量发布、置顶与删除</p>
        </div>
        <Link className="btn btn--primary" to="/posts/new"><Icon name="plus" size={15} />新建文章</Link>
      </div>

      <div className="toolbar">
        <div className="seg-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={status === t.key ? 'is-active' : ''} onClick={() => update({ status: t.key })}>
              {t.label}
            </button>
          ))}
        </div>

        <form
          className="search-input"
          onSubmit={(e) => { e.preventDefault(); update({ q: search }); }}
        >
          <Icon name="search" size={15} />
          <input className="input" placeholder="搜索标题或别名" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>

        <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="排序">
          <option value="newest">最新创建</option>
          <option value="updated">最近更新</option>
          <option value="views">阅读最多</option>
          <option value="title">标题排序</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link className="btn btn--ghost btn--sm" to="/posts/trash"><Icon name="trash" size={14} />回收站</Link>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="toolbar" style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-elev)' }}>
          <span style={{ fontSize: '0.84rem' }}>已选 {selected.length} 项</span>
          <button className="btn btn--sm" onClick={() => doBatch('publish')} disabled={busy}>批量发布</button>
          <button className="btn btn--sm" onClick={() => doBatch('draft')} disabled={busy}>转为草稿</button>
          <button className="btn btn--sm" onClick={() => doBatch('pin')} disabled={busy}>置顶</button>
          <button className="btn btn--sm" onClick={() => doBatch('unpin')} disabled={busy}>取消置顶</button>
          <button className="btn btn--sm btn--danger" onClick={() => setConfirm({ type: 'batch-delete' })} disabled={busy}>删除</button>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          {!rows && <TableSkeleton rows={8} cols={6} />}
          {rows && rows.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox" className="row-check" checked={allChecked}
                      onChange={() => setSelected(allChecked ? [] : rows.map((r) => r.id))}
                      aria-label="全选"
                    />
                  </th>
                  <th>标题</th>
                  <th style={{ width: 90 }}>状态</th>
                  <th style={{ width: 110 }}>分类</th>
                  <th style={{ width: 90 }}>浏览</th>
                  <th style={{ width: 90 }}>评论</th>
                  <th style={{ width: 110 }}>发布日期</th>
                  <th style={{ width: 130, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox" className="row-check" checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)} aria-label={`选择 ${r.title}`}
                      />
                    </td>
                    <td className="col-title">
                      <strong>
                        {r.is_pinned ? <Icon name="pin" size={12} style={{ verticalAlign: -1, color: 'var(--accent)' }} /> : null}
                        {' '}{r.title}
                      </strong>
                      <small>/{r.slug}</small>
                    </td>
                    <td><StatusTag status={r.status} /></td>
                    <td className="num">{r.category_name || '—'}</td>
                    <td className="num">{r.view_count}</td>
                    <td className="num">{r.comment_count}</td>
                    <td className="num">{fmtDate(r.published_at)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="icon-btn" title={r.is_pinned ? '取消置顶' : '置顶'}
                          onClick={() => quickPatch(r.id, { is_pinned: !r.is_pinned })}
                          style={r.is_pinned ? { color: 'var(--accent)' } : undefined}
                        >
                          <Icon name="pin" size={15} />
                        </button>
                        <button
                          className="icon-btn" title={r.is_featured ? '取消推荐' : '设为推荐'}
                          onClick={() => quickPatch(r.id, { is_featured: !r.is_featured })}
                          style={r.is_featured ? { color: 'var(--accent)' } : undefined}
                        >
                          <Icon name="star" size={15} />
                        </button>
                        <button className="icon-btn" title="编辑" onClick={() => navigate(`/posts/${r.id}`)}>
                          <Icon name="edit" size={15} />
                        </button>
                        <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setConfirm({ type: 'delete', item: r })}>
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows && !rows.length && (
            <EmptyState icon="file" title="没有符合条件的文章">
              <Link className="btn btn--primary btn--sm" to="/posts/new">写第一篇</Link>
            </EmptyState>
          )}
        </div>
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={(p) => update({ page: p })} />}
      </div>

      <ConfirmDialog
        open={!!confirm}
        danger
        busy={busy}
        title={confirm?.type === 'batch-delete' ? '批量删除' : '删除文章'}
        message={confirm?.type === 'batch-delete'
          ? `确定把选中的 ${selected.length} 篇文章移入回收站？`
          : `确定把《${confirm?.item?.title || ''}》移入回收站？`}
        confirmText="移入回收站"
        onCancel={() => setConfirm(null)}
        onConfirm={() => (confirm?.type === 'batch-delete' ? doBatch('delete') : remove(confirm.item.id))}
      />
    </div>
  );
}
