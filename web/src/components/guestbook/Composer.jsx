import { useState } from 'react';
import { Icon } from '../Icon';

const MOODS = [
  { key: 'happy', label: '开心' },
  { key: 'love', label: '喜欢' },
  { key: 'think', label: '思考' },
  { key: 'cool', label: '酷' },
  { key: 'sad', label: '难过' },
];

/** 底部发布栏 */
export default function Composer({ loggedIn, busy, onSubmit, feedback }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  const [mood, setMood] = useState(null);

  if (!open) {
    return (
      <div className="gb-dock">
        {feedback && <span className={feedback.ok ? 'gb-dock__ok' : 'gb-dock__err'}>{feedback.text}</span>}
        <button className="btn btn--solid gb-dock__btn" onClick={() => setOpen(true)}>
          <Icon name="message" size={16} />
          我要留言
        </button>
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({ text: text.trim(), nickname: nickname.trim(), mood });
    setText('');
    setMood(null);
    setOpen(false);
  };

  return (
    <form className="gb-dock" onSubmit={submit}>
      <div className="gb-composer">
        {feedback && <span className={feedback.ok ? 'gb-dock__ok' : 'gb-dock__err'}>{feedback.text}</span>}
        {!loggedIn && (
          <input
            className="input gb-composer__name"
            placeholder="昵称（可留空）"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={64}
          />
        )}
        <input
          className="input gb-composer__text"
          placeholder="写下你想说的话…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          autoFocus
        />
        <select
          className="select gb-composer__mood"
          value={mood || ''}
          onChange={(e) => setMood(e.target.value || null)}
          aria-label="心情"
        >
          <option value="">心情</option>
          {MOODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <button className="btn btn--solid" type="submit" disabled={busy || !text.trim()}>
          <Icon name="send" size={15} />发送
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>取消</button>
      </div>
    </form>
  );
}
