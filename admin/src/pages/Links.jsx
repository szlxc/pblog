import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Modal, EmptyState, ConfirmDialog, useToast } from '../components/ui';

const BLANK = { name: '', url: 'https://', avatar: '', description: '', sortOrder: 0, visible: true };

export default function Links() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get('/admin/links')
    .then(({ data }) => setRows(data || []))
    .catch((e) => { toast.error(e.message); setRows([]); });

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.name.trim() || !editing.url.trim()) { toast.error('名称和链接必填'); return; }
    setBusy(true);
    const payload = {
      name: editing.name, url: editing.url, avatar: editing.avatar || null,
      description: editing.description, sortOrder: Number(editing.sortOrder) || 0, visible: !!editing.visible,
    };
    try {
      if (editing.id) await api.put(`/admin/links/${editing.id}`, payload);
      else await api.post('/admin/links', payload);
      toast.toast('已保存'); setEditing(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/links/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>友情链接</h2><p>友链会在「友链」页面展示（前端 /p/links）</p></div>
        <button className="btn btn--primary" onClick={() => setEditing({ ...BLANK })}><Icon name="plus" size={15} />添加友链</button>
      </div>

      <div className="panel">
        {!rows && <div className="panel__body"><span className="spinner" /></div>}
        {rows && !rows.length && <EmptyState icon="link" title="还没有友链"><button className="btn btn--sm btn--primary" onClick={() => setEditing({ ...BLANK })}>添加</button></EmptyState>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>名称</th><th>链接</th><th style={{width:80}}>排序</th><th style={{width:80}}>状态</th><th style={{width:110, textAlign:'right'}}>操作</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong>{r.description ? <small style={{ display: 'block', color: 'var(--text-faint)' }}>{r.description}</small> : null}</td>
                    <td className="num" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{r.url}</a>
                    </td>
                    <td className="num">{r.sort_order}</td>
                    <td className="num">{r.visible ? '显示' : '隐藏'}</td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" title="编辑" onClick={() => setEditing({ ...r })}><Icon name="edit" size={15} /></button>
                        <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setConfirm(r)}><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} title={editing?.id ? '编辑友链' : '添加友链'} onClose={() => setEditing(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : '保存'}</button>
          </>
        )}>
        {editing && (
          <div className="form-grid">
            <div className="field"><label>站点名称</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>链接</label>
              <input className="input" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></div>
            <div className="field field--full"><label>头像地址（可选）</label>
              <input className="input" value={editing.avatar || ''} onChange={(e) => setEditing({ ...editing, avatar: e.target.value })} /></div>
            <div className="field field--full"><label>描述</label>
              <input className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="field"><label>排序</label>
              <input className="input" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></div>
            <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={!!editing.visible} onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} />显示在前台</label></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除友链"
        message={`确定删除「${confirm?.name || ''}」？`} onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
