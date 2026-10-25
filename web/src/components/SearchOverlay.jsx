import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { formatDate } from '../lib/format';

/** 搜索浮层：支持键盘上下选择、Enter 打开 */
export default function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return undefined; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/posts', { q: q.trim(), pageSize: 6 }, { signal: ctrl.signal });
        setResults(data || []);
        setActive(0);
      } catch (e) {
        if (e.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const go = (item) => {
    onClose();
    navigate(`/post/${encodeURIComponent(item.slug)}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && results[active]) go(results[active]);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="搜索文章">
      <button className="drawer-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="search-box">
        <div className="search-box__input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索文章标题或内容…"
            aria-label="搜索关键词"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-box__results">
          {loading && <p className="faint search-box__hint">搜索中…</p>}
          {!loading && q && !results.length && <p className="faint search-box__hint">没有找到相关文章</p>}
          {!q && <p className="faint search-box__hint">输入关键词开始搜索，支持 Ctrl/⌘ + K 随时唤起</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`search-item${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span className="search-item__title">{r.title}</span>
              <span className="search-item__meta faint">
                {formatDate(r.published_at)} {r.category_name ? `· ${r.category_name}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
