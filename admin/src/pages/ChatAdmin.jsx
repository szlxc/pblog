import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Pagination, EmptyState, ConfirmDialog, TableSkeleton, useToast } from '../components/ui';

export default function ChatAdmin() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [room, setRoom] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/chat', { page, room, pageSize: 30 });
      setRows(data); setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [page, room, toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (m) => {
    try {
      await api.patch(`/admin/chat/${m.id}`, { status: m.status === 'visible' ? 'hidden' : 'visible' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/chat/${confirm.id}`);
      toast.toast('已删除'); setConfirm(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>聊天室管理</h2><p>审核并删除聊天消息</p></div>
      </div>

      <div className="toolbar">
        <div className="seg-tabs">
          {[['', '全部'], ['public', '公共聊天室'], ['members', '用户聊天室']].map(([k, label]) => (
            <button key={k} className={room === k ? 'is-active' : ''} onClick={() => { setRoom(k); setPage(1); }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        {!rows && <TableSkeleton rows={8} cols={4} />}
        {rows && !rows.length && <EmptyState icon="message" title="暂无消息" />}
        {rows && rows.map((m) => (
          <div key={m.id} className="comment-row">
            <div className="comment-row__head">
              <strong>{m.nickname}</strong>
              <span className="chip chip--mini">{m.room === 'members' ? '用户房' : '公共房'}</span>
              {m.status === 'hidden' && <span className="status status--spam">已隐藏</span>}
              {m.media_type && <span className="chip chip--mini">{m.media_type === 'video' ? '视频' : '图片'}</span>}
              <span className="faint" style={{ marginLeft: 'auto' }}>{new Date(m.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
            </div>
            {m.content && <p className="comment-row__text">{m.content}</p>}
            {m.media_url && (
              <a href={m.media_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                查看附件
              </a>
            )}
            <div className="comment-row__actions">
              <button className="btn btn--sm" onClick={() => toggle(m)}>{m.status === 'visible' ? '隐藏' : '恢复'}</button>
              <button className="btn btn--sm btn--danger" onClick={() => setConfirm(m)}>删除</button>
            </div>
          </div>
        ))}
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={setPage} />}
      </div>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除消息"
        message="删除后不可恢复，确定继续？" onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
