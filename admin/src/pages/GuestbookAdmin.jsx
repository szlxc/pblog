import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Pagination, EmptyState, ConfirmDialog, Modal, TableSkeleton, useToast } from '../components/ui';

export default function GuestbookAdmin() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [reply, setReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/guestbook', { page, pageSize: 30 });
      setRows(data); setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (g) => {
    try {
      await api.patch(`/admin/guestbook/${g.id}`, { status: g.status === 'hidden' ? 'approved' : 'hidden' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/guestbook/${confirm.id}`);
      toast.toast('已删除'); setConfirm(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/guestbook/${reply.id}/reply`, { content: replyText });
      toast.toast('已回复'); setReply(null); setReplyText(''); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>留言墙管理</h2><p>审核、回复或隐藏访客留言</p></div>
      </div>

      <div className="panel">
        {!rows && <TableSkeleton rows={6} cols={3} />}
        {rows && !rows.length && <EmptyState icon="message-square" title="暂无留言" />}
        {rows && rows.map((g) => (
          <div key={g.id} className="comment-row">
            <div className="comment-row__head">
              <strong>{g.nickname}</strong>
              {g.is_admin ? <span className="chip chip--accent chip--mini">博主</span> : null}
              {g.parent_id ? <span className="chip chip--mini">回复</span> : null}
              {g.status === 'hidden' && <span className="status status--spam">已隐藏</span>}
              <span className="faint" style={{ marginLeft: 'auto' }}>{new Date(g.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
            </div>
            <p className="comment-row__text">{g.content}</p>
            <div className="comment-row__actions">
              <button className="btn btn--sm" onClick={() => { setReply(g); setReplyText(''); }}><Icon name="message" size={13} />回复</button>
              <button className="btn btn--sm" onClick={() => toggle(g)}>{g.status === 'hidden' ? '恢复' : '隐藏'}</button>
              <button className="btn btn--sm btn--danger" onClick={() => setConfirm(g)}>删除</button>
            </div>
          </div>
        ))}
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={setPage} />}
      </div>

      <Modal open={!!reply} title="回复留言" onClose={() => setReply(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setReply(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={sendReply} disabled={busy}>{busy ? <span className="spinner" /> : '发送'}</button>
          </>
        )}>
        {reply && (
          <div>
            <div className="comment-row__text" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14 }}>
              <strong>{reply.nickname}</strong>：{reply.content}
            </div>
            <div className="field">
              <label>你的回复</label>
              <textarea className="textarea" rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除留言"
        message="删除后不可恢复，确定继续？" onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
