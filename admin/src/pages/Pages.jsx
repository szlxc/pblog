import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Modal, StatusTag, EmptyState, ConfirmDialog, useToast } from '../components/ui';

const BLANK = { title: '', slug: '', content: '', contentFormat: 'markdown', status: 'published', showInNav: false, sortOrder: 0 };

export default function Pages() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const load = () => api.get('/admin/pages')
    .then(({ data }) => setRows(data || []))
    .catch((e) => { toast.error(e.message); setRows([]); });

  useEffect(() => { load(); }, []);

  const openNew = () => setEditing({ ...BLANK });
  const openEdit = async (row) => {
    try {
      const { data } = await api.get(`/admin/pages/${row.id}`);
      setEditing({ ...data, contentFormat: data.content_format, showInNav: !!data.show_in_nav, sortOrder: data.sort_order });
    } catch (e) { toast.error(e.message); }
  };

  const save = async () => {
    if (!editing.title.trim()) { toast.error('请填写标题'); return; }
    setBusy(true);
    const payload = {
      title: editing.title, slug: editing.slug || undefined, content: editing.content,
      contentFormat: editing.contentFormat, status: editing.status,
      showInNav: editing.showInNav, sortOrder: Number(editing.sortOrder) || 0,
    };
    try {
      if (editing.id) await api.put(`/admin/pages/${editing.id}`, payload);
      else await api.post('/admin/pages', payload);
      toast.toast('已保存');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/pages/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>独立页面</h2><p>关于、友链等固定页面，可显示在前台导航</p></div>
        <button className="btn btn--primary" onClick={openNew}><Icon name="plus" size={15} />新建页面</button>
      </div>

      <div className="panel">
        {!rows && <div className="panel__body"><span className="spinner" /></div>}
        {rows && !rows.length && <EmptyState icon="menuBook" title="还没有独立页面"><button className="btn btn--sm btn--primary" onClick={openNew}>新建页面</button></EmptyState>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>标题</th><th style={{width:90}}>状态</th><th style={{width:110}}>导航显示</th><th style={{width:80}}>排序</th><th style={{width:120, textAlign:'right'}}>操作</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="col-title"><strong>{r.title}</strong><small>/p/{r.slug}</small></td>
                    <td><StatusTag status={r.status} /></td>
                    <td className="num">{r.show_in_nav ? '是' : '否'}</td>
                    <td className="num">{r.sort_order}</td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" title="编辑" onClick={() => openEdit(r)}><Icon name="edit" size={15} /></button>
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

      <Modal
        open={!!editing} width={760} title={editing?.id ? '编辑页面' : '新建页面'}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : '保存'}</button>
          </>
        )}
      >
        {editing && (
          <div>
            <div className="form-grid">
              <div className="field"><label>标题</label>
                <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="field"><label>别名（URL）</label>
                <input className="input" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="about" /></div>
              <div className="field"><label>状态</label>
                <select className="select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="published">已发布</option><option value="draft">草稿</option>
                </select></div>
              <div className="field"><label>排序</label>
                <input className="input" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></div>
              <div className="field field--full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!editing.showInNav} onChange={(e) => setEditing({ ...editing, showInNav: e.target.checked })} />
                  在前台导航栏显示
                </label>
              </div>
            </div>
            <div className="field">
              <label>内容（Markdown / HTML）</label>
              <textarea
                className="textarea textarea--code" rows={14}
                value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm} danger busy={busy} title="删除页面"
        message={`确定删除《${confirm?.title || ''}》？此操作不可恢复。`}
        onCancel={() => setConfirm(null)} onConfirm={remove}
      />
    </div>
  );
}
