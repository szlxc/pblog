import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getMemberToken } from '../lib/api';
import { useMember } from '../context/MemberContext';
import SiteContext from '../context/SiteContext';
import { Icon } from '../components/Icon';
import { relativeTime } from '../lib/format';

/**
 * 聊天室：公共房（任何人可发文字）+ 登录用户房（可发图片/视频）
 * 实时消息走 SSE，断线自动重连
 */
export default function Chat() {
  const { site } = SiteContext.useSite();
  const { member, status, isAdmin } = useMember();
  const [params, setParams] = useSearchParams();
  const room = params.get('room') === 'members' ? 'members' : 'public';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [preview, setPreview] = useState(null);

  const listRef = useRef(null);
  const esRef = useRef(null);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const isMember = room === 'members';
  const canPost = !isMember || status === 'authed';
  const chatEnabled = site?.community?.chatEnabled !== false && site?.plugins?.chat !== false;

  /* ---------- 加载历史 ---------- */
  useEffect(() => {
    if (!chatEnabled) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    setMessages([]);
    api.get('/chat/history', { room, limit: 60 })
      .then(({ data }) => { if (alive) setMessages(data || []); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [room, chatEnabled]);

  /* ---------- SSE 实时推送 ---------- */
  useEffect(() => {
    if (!chatEnabled) return undefined;
    if (isMember && status !== 'authed') return undefined;

    let closed = false;
    let retryTimer = null;

    const connect = () => {
      if (closed) return;
      const base = (api.baseUrl || '').replace(/\/$/, '');
      const token = getMemberToken();
      // EventSource 不能自定义 Header，改用查询参数传 token（后端 optionalAuth 会读 header，
      // 因此这里走同源 cookie 或退化为轮询兜底）。为简单起见使用 fetch 流式读取。
      const url = `${base}/api/chat/stream?room=${room}${token ? `&t=${encodeURIComponent(token)}` : ''}`;

      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((res) => {
          if (!res.ok || !res.body) throw new Error('连接失败');
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          const pump = () => reader.read().then(({ done, value }) => {
            if (done) {
              if (!closed) retryTimer = setTimeout(connect, 3000);
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
              if (!dataLine) continue;
              try {
                const payload = JSON.parse(dataLine.slice(5).trim());
                if (payload.id) {
                  setMessages((list) => (list.some((m) => m.id === payload.id) ? list : [...list, payload]));
                }
              } catch (_) { /* 忽略心跳 */ }
            }
            pump();
          }).catch(() => {
            if (!closed) retryTimer = setTimeout(connect, 3000);
          });

          pump();
        })
        .catch(() => {
          if (!closed) retryTimer = setTimeout(connect, 3000);
        });
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [room, chatEnabled, isMember, status]);

  /* ---------- 在线人数轮询 ---------- */
  useEffect(() => {
    if (!chatEnabled) return undefined;
    const load = () => api.get('/chat/online', { room }).then(({ data }) => setOnline(data.online)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [room, chatEnabled]);

  /* ---------- 自动滚到底 ---------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault();
    if (!canPost) return;
    if (!text.trim() && !pendingMedia) return;
    setSending(true);
    setError(null);
    try {
      await api.post('/chat/send', {
        room,
        content: text.trim() || undefined,
        mediaUrl: pendingMedia?.url,
        mediaType: pendingMedia?.mediaType,
        nickname: member?.display_name || member?.username,
      }, { auth: isMember ? 'member' : false });
      setText('');
      setPendingMedia(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const onPickFile = async (file) => {
    if (!file) return;
    setUploading(1);
    try {
      const res = await api.upload(file, setUploading);
      setPendingMedia(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(0);
    }
  };

  if (!chatEnabled) {
    return (
      <div className="container empty-wrap">
        <div className="empty card">
          <Icon name="message" size={28} />
          <h2>聊天室暂未开放</h2>
          <Link className="btn btn--solid" to="/">回到首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container chat-page">
      <header className="page-head">
        <p className="eyebrow">Chat</p>
        <h1>聊天室</h1>
        <div className="chat-rooms">
          <button
            className={`chat-room-tab${room === 'public' ? ' is-active' : ''}`}
            onClick={() => setParams({ room: 'public' })}
          >
            <Icon name="users" size={15} />
            公共聊天室
          </button>
          <button
            className={`chat-room-tab${room === 'members' ? ' is-active' : ''}`}
            onClick={() => setParams({ room: 'members' })}
          >
            <Icon name="lock" size={14} />
            用户聊天室
            {status !== 'authed' && <span className="chat-room-tab__hint">需登录</span>}
          </button>
          <span className="chat-online faint">
            <span className="chat-online__dot" />
            {online} 人在线
          </span>
        </div>
      </header>

      {isMember && status !== 'authed' ? (
        <div className="chat-gate card">
          <Icon name="lock" size={26} />
          <h2>这个房间需要登录</h2>
          <p className="muted">登录后可以发送图片和视频。</p>
          <div className="row">
            <Link className="btn btn--solid" to="/login" state={{ from: '/chat?room=members' }}>登录</Link>
            {site?.community?.registerOpen !== false && <Link className="btn" to="/register">注册账号</Link>}
          </div>
        </div>
      ) : (
        <div className="chat-shell card">
          <div className="chat-list" ref={listRef}>
            {loading && <div className="chat-empty faint">加载中…</div>}
            {!loading && !messages.length && (
              <div className="chat-empty faint">还没有消息，说点什么吧。</div>
            )}
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                msg={m}
                isMine={member && m.user_id === member.id}
                isAdmin={isAdmin}
                onPreview={setPreview}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-err chat-error">{error}</p>}

          <form className="chat-input" onSubmit={send}>
            {pendingMedia && (
              <div className="chat-attach">
                {pendingMedia.mediaType === 'video' ? (
                  <video src={pendingMedia.url} muted />
                ) : (
                  <img src={pendingMedia.url} alt="" />
                )}
                <button type="button" className="chat-attach__remove" onClick={() => setPendingMedia(null)} aria-label="移除附件">
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}
            {uploading > 0 && <div className="chat-uploading faint">上传中 {uploading}%</div>}

            <div className="chat-input__row">
              <textarea
                className="chat-input__text"
                rows={2}
                maxLength={1000}
                placeholder={isMember ? '说点什么，支持发送图片和视频…' : '以访客身份发言…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
                }}
              />
              {isMember && (
                <>
                  <button
                    type="button" className="chat-tool" title="发送图片或视频"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="image" size={18} />
                  </button>
                  <input
                    ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/webm"
                    onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }}
                  />
                </>
              )}
              <button className="btn btn--solid chat-send" type="submit" disabled={sending || (!text.trim() && !pendingMedia)}>
                <Icon name="send" size={16} />
                发送
              </button>
            </div>
            <div className="chat-hint faint">
              {isMember ? 'Enter 发送，Shift+Enter 换行' : '访客只能发送文字；登录后可发图片和视频'}
              {status === 'authed' && (
                <span> · 以 <b>{member?.display_name || member?.username}</b>{isAdmin ? '（管理员）' : ''} 身份发言</span>
              )}
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="media-viewer" onClick={() => setPreview(null)}>
          <button className="media-viewer__close" aria-label="关闭"><Icon name="x" size={22} /></button>
          {preview.media_type === 'video' ? (
            <video src={preview.media_url} controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={preview.media_url} alt="" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}

function ChatMessage({ msg, isMine, isAdmin, onPreview }) {
  const initial = (msg.nickname || '?').charAt(0).toUpperCase();
  return (
    <div className={`chat-msg${isMine ? ' is-mine' : ''}`}>
      <span className="chat-msg__avatar">
        {msg.avatar ? <img src={msg.avatar} alt="" /> : initial}
      </span>
      <div className="chat-msg__body">
        <div className="chat-msg__head">
          <span className="chat-msg__name">{msg.nickname}</span>
          {isAdmin && isMine ? <span className="chip chip--accent chip--mini">管理员</span> : null}
          <span className="chat-msg__time faint">{relativeTime(msg.created_at)}</span>
        </div>
        {msg.content && <p className="chat-msg__text">{msg.content}</p>}
        {msg.media_url && (
          <button className="chat-msg__media" onClick={() => onPreview(msg)} type="button">
            {msg.media_type === 'video' ? (
              <>
                <video src={msg.media_url} preload="metadata" muted />
                <span className="chat-msg__play"><Icon name="video" size={20} /></span>
              </>
            ) : (
              <img src={msg.media_url} alt="" loading="lazy" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
