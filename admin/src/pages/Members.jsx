import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Pagination, EmptyState, ConfirmDialog, StatusTag, TableSkeleton, useToast } from '../components/ui';

export default function Members() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/members', { page, q, pageSize: 20 });
      setRows(data); setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [page, q, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (u) => {
    try {
      await api.patch(`/admin/members/${u.id}`, { status: u.status === 'banned' ? 'active' : 'banned' });
      toast.toast(u.status === 'banned' ? '已解封' : '已封禁');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/members/${confirm.id}`);
      toast.toast('已删除'); setConfirm(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>用户管理</h2><p>注册的访客账号，可封禁或删除</p></div>
      </div>

      <div className="toolbar">
        <form className="search-input" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search); }}>
          <Icon name="search" size={15} />
          <input className="input" placeholder="搜索用户名 / 昵称 / 邮箱" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className="panel">
        <div className="table-wrap">
          {!rows && <TableSkeleton rows={6} cols={5} />}
          {rows && rows.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>用户</th><th style={{ width: 180 }}>邮箱</th><th style={{ width: 100 }}>状态</th>
                  <th style={{ width: 130 }}>注册时间</th><th style={{ width: 130, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="col-title">
                      <strong>{u.display_name || u.username}</strong>
                      <small>@{u.username}</small>
                    </td>
                    <td className="num">{u.email || '—'}</td>
                    <td>
                      {u.status === 'banned'
                        ? <span className="status status--spam">已封禁</span>
                        : u.email_verified_at
                          ? <span className="status status--approved">已验证</span>
                          : <span className="status status--draft">未验证</span>}
                    </td>
                    <td className="num">{String(u.created_at).slice(0, 10)}</td>
                    <td>
                      <div className="actions">
                        <button className="btn btn--sm" onClick={() => toggleBan(u)}>
                          {u.status === 'banned' ? '解封' : '封禁'}
                        </button>
                        <button className="icon-btn icon-btn--danger" title="删除" onClick={() => setConfirm(u)}>
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows && !rows.length && <EmptyState icon="user" title="还没有注册用户" />}
        </div>
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={setPage} />}
      </div>

      <ConfirmDialog
        open={!!confirm} danger busy={busy} title="删除用户"
        message={`确定删除用户「${confirm?.username || ''}」？其发布的聊天消息会保留但不再关联账号。`}
        onCancel={() => setConfirm(null)} onConfirm={remove}
      />
    </div>
  );
}
