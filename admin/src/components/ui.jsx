import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';

/* ---------------- Toast ---------------- */
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, type = 'ok', ms = 2800) => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, type }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), ms);
  }, []);

  const value = useMemo(() => ({
    toast: (m) => push(m, 'ok'),
    error: (m) => push(m, 'err', 4200),
  }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-root" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast__dot" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || { toast: () => {}, error: () => {} };
}

/* ---------------- Modal ---------------- */
export function Modal({ title, open, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ '--modal-w': `${width}px` }}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><Icon name="x" size={16} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- 确认框 ---------------- */
export function ConfirmDialog({ open, title = '确认操作', message, confirmText = '确认', danger, onConfirm, onCancel, busy }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={420}
      footer={(
        <>
          <button className="btn" onClick={onCancel} disabled={busy}>取消</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" /> : confirmText}
          </button>
        </>
      )}
    >
      <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.7 }}>{message}</p>
    </Modal>
  );
}

/* ---------------- 分页 ---------------- */
export function Pagination({ meta, onChange }) {
  if (!meta) return null;
  const { page, totalPages, total, pageSize } = meta;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <span>共 {total} 条 · 第 {page} / {totalPages} 页（每页 {pageSize}）</span>
      <div className="pagination__pages">
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(1)} title="首页">
          <Icon name="chevronLeft" size={14} />
        </button>
        {pages.map((p) => (
          <button key={p} className={`page-btn${p === page ? ' is-active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(totalPages)} title="末页">
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- 状态标签 ---------------- */
const STATUS_TEXT = {
  published: '已发布', draft: '草稿', scheduled: '定时', private: '私密',
  pending: '待审核', approved: '已通过', spam: '垃圾', rejected: '已拒绝',
};

export function StatusTag({ status }) {
  return <span className={`status status--${status}`}>{STATUS_TEXT[status] || status}</span>;
}

/* ---------------- 空态 ---------------- */
export function EmptyState({ icon = 'file', title = '暂无数据', children }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={26} />
      <p>{title}</p>
      {children}
    </div>
  );
}

/* ---------------- 骨架 ---------------- */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton-line" style={{
              flex: c === 0 ? 2 : 1, height: 13, borderRadius: 4,
              background: 'var(--bg-hover)', opacity: 1 - r * 0.12,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
