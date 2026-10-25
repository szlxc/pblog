import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { formatDate, formatNumber } from '../lib/format';

/** 文章封面：无封面时用渐变占位，避免纯文字单调 */
function Cover({ post, compact }) {
  if (post.cover_image) {
    return <img className="post-card__cover-img" src={post.cover_image} alt="" loading="lazy" decoding="async" />;
  }
  const hue = (String(post.slug || post.title).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360);
  return (
    <div
      className={`post-card__cover post-card__cover--gen${compact ? ' is-compact' : ''}`}
      style={{ '--h': hue }}
      aria-hidden="true"
    >
      <span className="post-card__cover-grid" />
      <span className="post-card__cover-label">{(post.category_name || 'NOTE').toUpperCase()}</span>
    </div>
  );
}

export default function PostCard({ post, featured = false, index = 0 }) {
  return (
    <article
      className={`post-card card card--link${featured ? ' post-card--featured' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link to={`/post/${encodeURIComponent(post.slug)}`} viewTransition className="post-card__link" aria-label={post.title}>
        <Cover post={post} compact={featured} />
        <div className="post-card__body">
          <div className="post-card__flags">
            {post.is_pinned ? <span className="chip chip--accent"><Icon name="pin" size={13} />置顶</span> : null}
            {post.category_name && (
              <span className="chip" style={post.category_color ? { color: post.category_color, borderColor: 'currentColor' } : undefined}>
                {post.category_name}
              </span>
            )}
          </div>
          <h2 className="post-card__title">{post.title}</h2>
          {post.summary && <p className="post-card__summary">{post.summary}</p>}
          <div className="post-card__tags">
            {(post.tags || []).slice(0, 3).map((t) => (
              <Link key={t.id} to={`/tags?tag=${t.slug}`} className="chip chip--mini" onClick={(e) => e.stopPropagation()}>
                {t.name}
              </Link>
            ))}
          </div>
          <footer className="post-card__meta faint">
            <span><Icon name="calendar" size={14} />{formatDate(post.published_at)}</span>
            {post.reading_time ? <span><Icon name="clock" size={14} />{post.reading_time} 分钟</span> : null}
            <span><Icon name="eye" size={14} />{formatNumber(post.view_count)}</span>
            {post.comment_count > 0 && <span><Icon name="message" size={14} />{post.comment_count}</span>}
          </footer>
        </div>
      </Link>
    </article>
  );
}
