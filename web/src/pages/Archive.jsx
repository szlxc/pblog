import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, monthLabel } from '../lib/format';
import { Icon } from '../components/Icon';
import { CAN_TRANSITION } from '../lib/viewTransition';

export default function Archive() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState('all');

  useEffect(() => {
    api.get('/archive').then(({ data }) => setGroups(data)).catch((e) => setError(e.message));
  }, []);

  const years = useMemo(() => {
    if (!groups) return [];
    return Array.from(new Set(groups.map((g) => g.year))).sort((a, b) => b - a);
  }, [groups]);

  const visible = (groups || []).filter((g) => year === 'all' || String(g.year) === String(year));
  const total = (groups || []).reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="container archive">
      <header className="page-head rise">
        <p className="eyebrow">Archive</p>
        <h1>归档</h1>
        <p className="muted">共 {total} 篇文章，按时间倒序排列。</p>
      </header>

      <div className="year-tabs">
        <button className={`year-tab${year === 'all' ? ' is-active' : ''}`} onClick={() => setYear('all')}>全部</button>
        {years.map((y) => (
          <button key={y} className={`year-tab${String(year) === String(y) ? ' is-active' : ''}`} onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
      </div>

      {error && <div className="alert">{error}</div>}
      {!groups && <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />}

      <div className="timeline">
        {visible.map((g) => (
          <section key={g.month} className="timeline__group">
            <h2 className="timeline__month">
              <span className="timeline__dot" aria-hidden="true" />
              {monthLabel(g.month)}
              <span className="faint timeline__count">{g.items.length} 篇</span>
            </h2>
            <ul className="timeline__list">
              {g.items.map((p) => (
                <li key={p.id}>
                  <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} to={`/post/${encodeURIComponent(p.slug)}`} className="timeline__item">
                    <span className="timeline__date faint">{formatDate(p.published_at, 'short')}</span>
                    <span className="timeline__title">{p.title}</span>
                    <span className="timeline__arrow"><Icon name="arrow-right" size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups && !visible.length && <p className="faint">该年份没有文章。</p>}
      </div>
    </div>
  );
}
