import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Modal, EmptyState, ConfirmDialog, useToast } from '../components/ui';

const COLORS = ['#818cf8', '#6ee7b7', '#fbbf24', '#fb7185', '#67e8f9', '#c084fc'];

export default function Tags() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [merge, setMerge] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get('/admin/tags')
    .then(({ data }) => setRows(data || []))
    .catch((e) => { toast.error(e.message); setRows([]); });

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.name.trim()) { toast.error('请填写标签名'); return; }
    setBusy(true);
    try {
      if (editing.id) await api.put(`/admin/tags/${editing.id}`, { name: editing.name, color: editing.color });
      else await api.post('/admin/tags', { name: editing.name, color: editing.color });
      toast.toast('已保存'); setEditing(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/tags/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doMerge = async () => {
    if (!merge?.sourceId || !merge?.targetId) { toast.error('请选择要合并的标签'); return; }
    setBusy(true);
    try {
      await api.post('/admin/tags/merge', { sourceId: merge.sourceId, targetId: merge.targetId });
      toast.toast('已合并'); setMerge(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>标签</h2><p>共 {rows?.length ?? '—'} 个标签，支持重命名与合并</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setMerge({ sourceId: '', targetId: '' })}><Icon name="link" size={15} />合并标签</button>
          <button className="btn btn--primary" onClick={() => setEditing({ name: '', color: COLORS[0] })}><Icon name="plus" size={15} />新建标签</button>
        </div>
      </div>

      <div className="panel">
        {!rows && <div className="panel__body"><span className="spinner" /></div>}
        {rows && !rows.length && <EmptyState icon="tag" title="还没有标签"><button className="btn btn--sm btn--primary" onClick={() => setEditing({ name: '', color: COLORS[0] })}>新建标签</button></EmptyState>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>名称</th><th style={{width:140}}>别名</th><th style={{width:100}}>文章数</th><th style={{width:110, textAlign:'right'}}>操作</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: r.color || 'var(--accent)', marginRight: 8 }} />
                      <strong>{r.name}</strong>
                    </td>
                    <td className="num">/{r.slug}</td>
                    <td className="num">{r.post_count}</td>
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

      <Modal open={!!editing} title={editing?.id ? '编辑标签' : '新建标签'} onClose={() => setEditing(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : '保存'}</button>
          </>
        )}>
        {editing && (
          <div>
            <div className="field"><label>标签名</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div className="field"><label>颜色</label>
              <div className="color-row">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: c })} aria-label={c}
                    style={{ width: 24, height: 24, borderRadius: 999, background: c, border: editing.color === c ? '2px solid var(--text)' : '1px solid var(--line)' }} />
                ))}
                <input type="color" value={editing.color || '#818cf8'} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div></div>
          </div>
        )}
      </Modal>

      <Modal open={!!merge} title="合并标签" onClose={() => setMerge(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setMerge(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={doMerge} disabled={busy}>{busy ? <span className="spinner" /> : '合并'}</button>
          </>
        )}>
        {merge && (
          <div>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.86rem' }}>把「来源标签」下的所有文章迁移到「目标标签」，然后删除来源标签。</p>
            <div className="field"><label>来源标签（将被删除）</label>
              <select className="select" value={merge.sourceId} onChange={(e) => setMerge({ ...merge, sourceId: e.target.value })}>
                <option value="">请选择</option>
                {(rows || []).map((r) => <option key={r.id} value={r.id}>{r.name}（{r.post_count}）</option>)}
              </select></div>
            <div className="field"><label>目标标签（保留）</label>
              <select className="select" value={merge.targetId} onChange={(e) => setMerge({ ...merge, targetId: e.target.value })}>
                <option value="">请选择</option>
                {(rows || []).filter((r) => String(r.id) !== String(merge.sourceId)).map((r) => <option key={r.id} value={r.id}>{r.name}（{r.post_count}）</option>)}
              </select></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除标签"
        message={`确定删除标签「${confirm?.name || ''}」？关联文章将不再带此标签。`}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
