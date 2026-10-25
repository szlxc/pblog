import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Modal, EmptyState, ConfirmDialog, useToast } from '../components/ui';

const BLANK = { name: '', slug: '', description: '', color: '#818cf8', parentId: '', sortOrder: 0 };

export default function Categories() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get('/admin/categories')
    .then(({ data }) => setRows(data || []))
    .catch((e) => { toast.error(e.message); setRows([]); });

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.name.trim()) { toast.error('请填写分类名称'); return; }
    setBusy(true);
    const payload = {
      name: editing.name, slug: editing.slug || undefined, description: editing.description,
      color: editing.color, parentId: editing.parentId || null, sortOrder: Number(editing.sortOrder) || 0,
    };
    try {
      if (editing.id) await api.put(`/admin/categories/${editing.id}`, payload);
      else await api.post('/admin/categories', payload);
      toast.toast('已保存'); setEditing(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/categories/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const roots = (rows || []).filter((r) => !r.parent_id);
  const childrenOf = (id) => (rows || []).filter((r) => Number(r.parent_id) === Number(id));

  return (
    <div>
      <div className="page-title">
        <div><h2>分类</h2><p>支持两级分类，用于组织文章</p></div>
        <button className="btn btn--primary" onClick={() => setEditing({ ...BLANK })}><Icon name="plus" size={15} />新建分类</button>
      </div>

      <div className="panel">
        {!rows && <div className="panel__body"><span className="spinner" /></div>}
        {rows && !rows.length && <EmptyState icon="folder" title="还没有分类"><button className="btn btn--sm btn--primary" onClick={() => setEditing({ ...BLANK })}>新建分类</button></EmptyState>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>名称</th><th style={{width:150}}>别名</th><th style={{width:90}}>文章数</th><th style={{width:80}}>排序</th><th style={{width:110, textAlign:'right'}}>操作</th></tr></thead>
              <tbody>
                {roots.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.color || 'var(--accent)', marginRight: 8 }} />
                        <strong>{r.name}</strong>
                        {r.description ? <small style={{ display: 'block', color: 'var(--text-faint)', marginLeft: 16 }}>{r.description}</small> : null}
                      </td>
                      <td className="num">/{r.slug}</td>
                      <td className="num">{r.post_count}</td>
                      <td className="num">{r.sort_order}</td>
                      <td>
                        <div className="actions">
                          <button className="icon-btn" title="编辑" onClick={() => setEditing({ ...r, parentId: r.parent_id || '', sortOrder: r.sort_order })}><Icon name="edit" size={15} /></button>
                          <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setConfirm(r)}><Icon name="trash" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                    {childrenOf(r.id).map((c) => (
                      <tr key={c.id} style={{ background: 'color-mix(in oklab, var(--bg-panel) 40%, transparent)' }}>
                        <td style={{ paddingLeft: 34 }}><span style={{ color: 'var(--text-faint)', marginRight: 6 }}>└</span>{c.name}</td>
                        <td className="num">/{c.slug}</td>
                        <td className="num">{c.post_count}</td>
                        <td className="num">{c.sort_order}</td>
                        <td>
                          <div className="actions">
                            <button className="icon-btn" title="编辑" onClick={() => setEditing({ ...c, parentId: c.parent_id || '', sortOrder: c.sort_order })}><Icon name="edit" size={15} /></button>
                            <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setConfirm(c)}><Icon name="trash" size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing} title={editing?.id ? '编辑分类' : '新建分类'} onClose={() => setEditing(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : '保存'}</button>
          </>
        )}
      >
        {editing && (
          <div className="form-grid">
            <div className="field"><label>名称</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>别名</label>
              <input className="input" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="自动生成" /></div>
            <div className="field"><label>父分类</label>
              <select className="select" value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })}>
                <option value="">无（顶级分类）</option>
                {roots.filter((r) => r.id !== editing.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></div>
            <div className="field"><label>排序</label>
              <input className="input" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></div>
            <div className="field"><label>颜色</label>
              <div className="color-row">
                <input type="color" value={editing.color || '#818cf8'} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                <input className="input" value={editing.color || ''} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div></div>
            <div className="field"><label>描述</label>
              <input className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除分类"
        message={`确定删除分类「${confirm?.name || ''}」？分类下若有文章将无法删除。`}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
