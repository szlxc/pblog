import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { StatusTag, Pagination, EmptyState, ConfirmDialog, TableSkeleton, useToast, Modal } from '../components/ui';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'spam', label: '垃圾' },
  { key: 'rejected', label: '已拒绝' },
];

const when = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-') : '');

export default function Comments() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState(q);
  const [confirm, setConfirm] = useState(null);
  const [reply, setReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/comments', { status, page, q, pageSize: 20 });
      setRows(data);
      setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [status, page, q, toast]);

  useEffect(() => { load(); }, [load]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k); else next.set(k, String(v));
    });
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const moderate = async (id, next) => {
    try { await api.patch(`/admin/comments/${id}`, { status: next }); toast.toast('已更新'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/comments/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) { toast.error('回复内容不能为空'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/comments/${reply.id}/reply`, { content: replyText });
      toast.toast('已回复'); setReply(null); setReplyText(''); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const counts = meta?.counts || {};

  return (
    <div>
      <div className="page-title">
        <div><h2>评论</h2><p>审核、回复与清理访客评论</p></div>
      </div>

      <div className="toolbar">
        <div className="seg-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={status === t.key ? 'is-active' : ''} onClick={() => update({ status: t.key })}>
              {t.label}{t.key === 'pending' && counts.pending ? ` (${counts.pending})` : ''}
            </button>
          ))}
        </div>
        <form className="search-input" onSubmit={(e) => { e.preventDefault(); update({ q: search }); }}>
          <Icon name="search" size={15} />
          <input className="input" placeholder="搜索内容或昵称" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className="panel">
        {!rows && <TableSkeleton rows={6} cols={3} />}
        {rows && !rows.length && <EmptyState icon="message" title="没有评论" />}
        {rows && rows.map((c) => (
          <div key={c.id} className="comment-row">
            <div className="comment-row__head">
              <strong>{c.author_name}</strong>
              {c.author_email ? <span className="faint">{c.author_email}</span> : null}
              <StatusTag status={c.status} />
              {c.reply_count > 0 ? <span className="faint">{c.reply_count} 条回复</span> : null}
              <span className="faint" style={{ marginLeft: 'auto' }}>{when(c.created_at)}</span>
            </div>
            <p className="comment-row__text">{c.content}</p>
            <div className="comment-row__actions">
              <span className="faint" style={{ fontSize: '0.78rem', marginRight: 4 }}>
                来自：{c.post_title ? `文章《${c.post_title}》` : c.page_title ? `页面《${c.page_title}》` : '—'}
              </span>
              {c.status !== 'approved' && <button className="btn btn--sm" onClick={() => moderate(c.id, 'approved')}><Icon name="check" size={13} />通过</button>}
              {c.status !== 'spam' && <button className="btn btn--sm" onClick={() => moderate(c.id, 'spam')}>标记垃圾</button>}
              {c.status !== 'rejected' && <button className="btn btn--sm" onClick={() => moderate(c.id, 'rejected')}>拒绝</button>}
              <button className="btn btn--sm" onClick={() => { setReply(c); setReplyText(''); }}><Icon name="message" size={13} />回复</button>
              <button className="btn btn--sm btn--danger" onClick={() => setConfirm(c)}>删除</button>
            </div>
          </div>
        ))}
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={(p) => update({ page: p })} />}
      </div>

      <Modal open={!!reply} title="回复评论" onClose={() => setReply(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setReply(null)} disabled={busy}>取消</button>
            <button className="btn btn--primary" onClick={sendReply} disabled={busy}>{busy ? <span className="spinner" /> : '发送回复'}</button>
          </>
        )}>
        {reply && (
          <div>
            <div className="comment-row__text" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14 }}>
              <strong>{reply.author_name}</strong>：{reply.content}
            </div>
            <div className="field">
              <label>你的回复</label>
              <textarea className="textarea" rows={5} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="以博主身份回复…" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除评论"
        message="删除后不可恢复，确定继续？" onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
