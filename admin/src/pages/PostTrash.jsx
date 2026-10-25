import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { EmptyState, ConfirmDialog, useToast } from '../components/ui';

export default function PostTrash() {
  const [rows, setRows] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => api.get('/admin/posts/trash/list')
    .then(({ data }) => setRows(data || []))
    .catch((e) => { toast.error(e.message); setRows([]); });

  useEffect(() => { load(); }, []);

  const restore = async (id) => {
    setBusy(true);
    try { await api.post(`/admin/posts/trash/${id}/restore`); toast.toast('已恢复'); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const purge = async (id) => {
    setBusy(true);
    try { await api.del(`/admin/posts/trash/${id}`); toast.toast('已永久删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>回收站</h2><p>删除的文章会保留在这里，可恢复或永久清除</p></div>
        <button className="btn" onClick={() => navigate('/posts')}><Icon name="chevronLeft" size={15} />返回文章</button>
      </div>
      <div className="panel">
        {!rows && <div className="panel__body"><span className="spinner" /></div>}
        {rows && !rows.length && <EmptyState icon="trash" title="回收站是空的"><Link className="btn btn--sm" to="/posts">返回文章列表</Link></EmptyState>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>标题</th><th style={{ width: 140 }}>删除时间</th><th style={{ width: 150, textAlign: 'right' }}>操作</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="col-title"><strong>{r.title}</strong><small>/{r.slug}</small></td>
                    <td className="num">{String(r.deleted_at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      <div className="actions">
                        <button className="btn btn--sm" onClick={() => restore(r.id)} disabled={busy}>恢复</button>
                        <button className="btn btn--sm btn--danger" onClick={() => setConfirm(r)} disabled={busy}>永久删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!confirm} danger busy={busy} title="永久删除"
        message={`《${confirm?.title || ''}》将被永久删除，无法恢复。确定继续？`}
        confirmText="永久删除" onCancel={() => setConfirm(null)} onConfirm={() => purge(confirm.id)}
      />
    </div>
  );
}
