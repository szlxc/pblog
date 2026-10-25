import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Pagination, TableSkeleton, useToast } from '../components/ui';

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/audit', { page, pageSize: 30 });
      setRows(data);
      setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-title">
        <div><h2>操作日志</h2><p>记录登录、修改密码与站点设置变更，便于审计</p></div>
      </div>
      <div className="panel">
        {!rows && <TableSkeleton rows={8} cols={4} />}
        {rows && !rows.length && <EmptyState icon="shield" title="暂无日志" />}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th style={{width:170}}>时间</th><th style={{width:120}}>用户</th><th>操作</th><th style={{width:160}}>对象</th><th style={{width:150}}>IP</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{new Date(r.created_at).toLocaleString('zh-CN', { hour12: false })}</td>
                    <td>{r.username || '—'}</td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{r.action}</code></td>
                    <td className="num">{r.target || '—'}</td>
                    <td className="num">{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={setPage} />}
      </div>
    </div>
  );
}
