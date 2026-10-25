import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { MOODS_FALLBACK } from './layout';

/**
 * 回复弹层
 * 左：被回复留言的完整上下文（含已有回复树）
 * 右：输入框
 */
export default function ReplyModal({ root, replyTarget, loggedIn, busy, onCancel, onSubmit }) {
  const [text, setText] = useState('');

  // root 缺失时直接关闭，避免崩溃
  if (!root) {
    console.warn('[ReplyModal] root 缺失');
    return null;
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <div className="gb-modal" role="dialog" aria-modal="true" aria-label="回复留言">
      <button className="gb-modal__backdrop" onClick={onCancel} aria-label="关闭" />

      <div className="gb-modal__left">
        <div className="gb-modal__card">
          <header className="gb-modal__head">
            <span className="gb-modal__avatar">
              {root.avatar ? <img src={root.avatar} alt="" /> : (root.nickname || '?').charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{root.nickname}</strong>
              <span className="faint">
                {new Date(root.created_at).toLocaleString('zh-CN', { hour12: false })}
                {root.mood ? ` · ${MOODS_FALLBACK[root.mood] || ''}` : ''}
              </span>
            </div>
            {root.is_admin ? <span className="chip chip--accent">博主</span> : null}
          </header>

          <p className="gb-modal__text">{root.content}</p>

          {root.replies?.length > 0 && (
            <div className="gb-modal__replies">
              <ReplyPreview nodes={root.replies} />
            </div>
          )}
        </div>
      </div>

      <div className="gb-modal__right">
        <div className="gb-modal__composer">
          <div className="gb-modal__composer-head">
            <h3>
              回复
              {replyTarget && replyTarget.id !== root.id ? (
                <span className="gb-modal__target"> @{replyTarget.nickname}</span>
              ) : null}
            </h3>
            <button className="icon-btn" onClick={onCancel} aria-label="关闭">
              <Icon name="x" size={18} />
            </button>
          </div>

          {!loggedIn && (
            <p className="faint gb-modal__hint">当前未登录，将以「访客」身份回复</p>
          )}

          <textarea
            className="gb-modal__input"
            rows={7}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写下你的回复…"
            autoFocus
          />

          <div className="gb-modal__actions">
            <span className="faint">{text.length} / 1000</span>
            <button className="btn btn--ghost" onClick={onCancel}>取消</button>
            <button
              className="btn btn--solid"
              onClick={submit}
              disabled={busy || !text.trim()}
            >
              {busy ? <span className="spinner" /> : <Icon name="send" size={15} />}
              发送回复
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 只读的回复树（弹层左侧用） */
function ReplyPreview({ nodes, depth = 0 }) {
  return (
    <ul className="gb-preview-list" style={{ marginLeft: depth ? 12 : 0 }}>
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="gb-preview-item">
            <strong>{n.nickname}</strong>
            {n.is_admin ? <span className="chip chip--accent chip--mini">博主</span> : null}
            <p>{n.content}</p>
          </div>
          {n.replies?.length > 0 && <ReplyPreview nodes={n.replies} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
