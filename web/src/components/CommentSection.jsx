import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { relativeTime } from '../lib/format';

/** 评论区：支持楼中楼、昵称/邮箱/站点、蜜罐字段防机器人 */
export default function CommentSection({ postId, postSlug }) {
  const [comments, setComments] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [sending, setSending] = useState(false);

  const load = () => api.get('/comments', { postId }).then(({ data }) => setComments(data || [])).catch(() => setComments([]));
  useEffect(() => { load(); }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      postId,
      parentId: replyTo,
      authorName: fd.get('authorName'),
      authorEmail: fd.get('authorEmail'),
      authorSite: fd.get('authorSite'),
      content: fd.get('content'),
      website: fd.get('website'),
    };
    if (!payload.content?.trim()) { setFeedback({ type: 'error', text: '请写点内容' }); return; }
    setSending(true);
    try {
      const res = await api.post('/comments', payload);
      setFeedback({
        type: 'ok',
        text: res.status === 'approved' ? '评论已发布' : '评论已提交，等待审核后显示',
      });
      form.reset();
      setReplyTo(null);
      localStorage.setItem('pblog.commenter', JSON.stringify({
        name: payload.authorName, email: payload.authorEmail, site: payload.authorSite,
      }));
      if (res.status === 'approved') load();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  const saved = (() => { try { return JSON.parse(localStorage.getItem('pblog.commenter') || '{}'); } catch (_) { return {}; } })();
  const total = (comments || []).reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  return (
    <section className="comments" id="comments">
      <h2 className="section-title">
        评论{comments ? <span className="faint"> · {total}</span> : null}
      </h2>

      <form className="comment-form card" onSubmit={submit} noValidate>
        {replyTo && (
          <div className="comment-form__reply">
            <Icon name="message" size={14} />
            <span>回复 #{replyTo}</span>
            <button type="button" className="btn btn--ghost" onClick={() => setReplyTo(null)}>取消</button>
          </div>
        )}
        <div className="comment-form__row">
          <label className="field">
            <span>昵称 *</span>
            <input name="authorName" required maxLength={80} defaultValue={saved.name || ''} placeholder="怎么称呼你" />
          </label>
          <label className="field">
            <span>邮箱</span>
            <input name="authorEmail" type="email" maxLength={190} defaultValue={saved.email || ''} placeholder="不会被公开" />
          </label>
          <label className="field">
            <span>网站</span>
            <input name="authorSite" maxLength={250} defaultValue={saved.site || ''} placeholder="https:// 可选" />
          </label>
        </div>
        {/* 蜜罐：对用户隐藏，机器人会填 */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hp-field" aria-hidden="true" />
        <label className="field">
          <span>内容 *</span>
          <textarea name="content" required rows={5} maxLength={5000} placeholder="说点什么…支持纯文本，换行会被保留" />
        </label>
        <div className="comment-form__foot">
          {feedback && <p className={feedback.type === 'ok' ? 'text-ok' : 'text-err'}>{feedback.text}</p>}
          <button className="btn btn--solid" type="submit" disabled={sending}>
            {sending ? <><Icon name="loader" size={15} className="spin" />提交中</> : '发表评论'}
          </button>
        </div>
      </form>

      <ol className="comment-list">
        {(comments || []).map((c) => (
          <li key={c.id} className="comment">
            <CommentBody comment={c} />
            {c.replies?.length > 0 && (
              <ol className="comment-list comment-list--nested">
                {c.replies.map((r) => (
                  <li key={r.id} className="comment comment--reply">
                    <CommentBody comment={r} onReply={() => setReplyTo(r.id)} />
                  </li>
                ))}
              </ol>
            )}
            <button className="comment__reply-btn" onClick={() => setReplyTo(c.id)}>回复</button>
          </li>
        ))}
        {comments && !comments.length && <p className="faint">还没有评论，来坐第一排。</p>}
      </ol>
    </section>
  );
}

function CommentBody({ comment, onReply }) {
  const initial = (comment.author_name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`comment__body${comment.is_admin ? ' is-admin' : ''}`}>
      <span className="comment__avatar" aria-hidden="true">{initial}</span>
      <div className="comment__main">
        <div className="comment__head">
          {comment.author_site ? (
            <a href={comment.author_site} target="_blank" rel="noopener noreferrer nofollow" className="comment__name">
              {comment.author_name}
            </a>
          ) : <span className="comment__name">{comment.author_name}</span>}
          {comment.is_admin ? <span className="chip chip--accent chip--mini">博主</span> : null}
          <span className="faint comment__time">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="comment__text">{comment.content}</p>
      </div>
    </div>
  );
}
