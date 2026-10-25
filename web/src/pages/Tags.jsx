import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { formatDate } from '../lib/format';
import { CAN_TRANSITION } from '../lib/viewTransition';

export default function Tags() {
  const [params, setParams] = useSearchParams();
  const active = params.get('tag');
  const [tags, setTags] = useState([]);
  const [cats, setCats] = useState([]);
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    api.get('/tags').then(({ data }) => setTags(data || [])).catch(() => {});
    api.get('/categories').then(({ data }) => setCats(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) { setPosts(null); return undefined; }
    let alive = true;
    setPosts(null);
    api.get('/posts', { tag: active, pageSize: 100 })
      .then(({ data }) => alive && setPosts(data || []))
      .catch(() => alive && setPosts([]));
    return () => { alive = false; };
  }, [active]);

  const max = useMemo(() => Math.max(1, ...tags.map((t) => t.post_count)), [tags]);

  return (
    <div className="container tags-page">
      <header className="page-head rise">
        <p className="eyebrow">Topics</p>
        <h1>标签与分类</h1>
        <p className="muted">共 {tags.length} 个标签，{cats.length} 个分类。</p>
      </header>

      <section className="card tags-block">
        <h2 className="section-title">全部标签</h2>
        <div className="tag-cloud tag-cloud--large">
          {tags.map((t) => {
            const weight = t.post_count / max;
            return (
              <button
                key={t.id}
                className={`tag-pill${active === t.slug ? ' is-active' : ''}`}
                onClick={() => setParams(active === t.slug ? {} : { tag: t.slug })}
                style={{ '--w': weight }}
              >
                <span>{t.name}</span>
                <span className="tag-pill__count">{t.post_count}</span>
              </button>
            );
          })}
          {!tags.length && <p className="faint">暂无标签</p>}
        </div>
      </section>

      <section className="card tags-block">
        <h2 className="section-title">分类</h2>
        <div className="cat-grid">
          {cats.map((c) => (
            <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} key={c.id} to={`/?category=${c.slug}`} className="cat-card card card--link">
              <span className="cat-card__bar" style={{ background: c.color || 'var(--accent)' }} />
              <div>
                <strong>{c.name}</strong>
                <p className="faint">{c.description || '—'}</p>
              </div>
              <span className="cat-card__count">{c.post_count}</span>
              {c.children?.length > 0 && (
                <p className="faint cat-card__children">
                  {c.children.map((ch) => ch.name).join(' · ')}
                </p>
              )}
            </Link>
          ))}
          {!cats.length && <p className="faint">暂无分类</p>}
        </div>
      </section>

      {active && (
        <section className="tags-block">
          <div className="row row--between">
            <h2 className="section-title">标签 <span className="chip chip--accent">{active}</span></h2>
            <button className="btn btn--ghost" onClick={() => setParams({})}>清除</button>
          </div>
          {!posts && <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />}
          <ul className="plain-list">
            {(posts || []).map((p) => (
              <li key={p.id}>
                <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} to={`/post/${encodeURIComponent(p.slug)}`} className="plain-list__item">
                  <span className="faint">{formatDate(p.published_at)}</span>
                  <span>{p.title}</span>
                  <Icon name="chevron-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
          {posts && !posts.length && <p className="faint">该标签下暂无文章。</p>}
        </section>
      )}
    </div>
  );
}
