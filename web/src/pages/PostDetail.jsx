import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import CommentSection from '../components/CommentSection';
import SiteContext from '../context/SiteContext';
import { formatDate, formatNumber } from '../lib/format';

export default function PostDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { site } = SiteContext.useSite();
  const [state, setState] = useState({ status: 'loading' });
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [activeToc, setActiveToc] = useState('');
  const articleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.get(`/posts/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!alive) return;
        setState({ status: 'ready', ...data });
        setLikeCount(data.post.like_count || 0);
        document.title = `${data.post.seo_title || data.post.title} · ${site?.frontend?.title || ''}`;
        const desc = data.post.seo_description || data.post.summary;
        if (desc) {
          let m = document.querySelector('meta[name="description"]');
          if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
          m.content = desc;
        }
        setLiked(localStorage.getItem(`pblog.liked.${slug}`) === '1');
        api.post(`/posts/${encodeURIComponent(slug)}/view`).catch(() => {});
      })
      .catch((e) => alive && setState({ status: 'error', message: e.message }));
    return () => { alive = false; };
  }, [slug, site?.frontend?.title]);

  // 目录高亮
  useEffect(() => {
    if (state.status !== 'ready' || !state.toc?.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveToc(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -70% 0px', threshold: [0, 1] }
    );
    state.toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [state]);

  // 阅读进度
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setProgress(total > 0 ? Math.min(100, (h.scrollTop / total) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 代码复制
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return undefined;
    const handler = async (e) => {
      const btn = e.target.closest('.code-copy');
      if (!btn) return;
      const code = btn.closest('figure')?.querySelector('code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 1600);
      } catch (_) {
        btn.textContent = '复制失败';
      }
    };
    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [state]);

  const onLike = async () => {
    if (liked) return;
    try {
      const res = await api.post(`/posts/${encodeURIComponent(slug)}/like`);
      setLikeCount(res.likeCount);
      setLiked(true);
      localStorage.setItem(`pblog.liked.${slug}`, '1');
    } catch (_) { /* 忽略 */ }
  };

  if (state.status === 'loading') {
    return (
      <div className="container--reading article-wrap">
        <div className="skeleton" style={{ height: 32, width: '70%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 40 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 14, width: `${90 - i * 6}%`, marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="container empty-wrap">
        <div className="empty card">
          <Icon name="book" size={28} />
          <h2>文章没找到</h2>
          <p className="muted">{state.message}</p>
          <button className="btn btn--solid" onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
    );
  }

  const { post, html, toc, prev, next, related } = state;
  const showToc = site?.plugins?.tableOfContents && toc?.length > 2;

  return (
    <div className="article-page">
      <div className="reading-progress" style={{ width: `${progress}%` }} aria-hidden="true" />

      <div className={`article-layout container${showToc ? ' article-layout--with-toc' : ''}`}>
        <article className="article" ref={articleRef}>
          <header className="article__head rise">
            <div className="article__crumbs faint">
              <Link to="/">首页</Link>
              <Icon name="chevron-right" size={13} />
              {post.category_name ? <Link to={`/?category=${post.category_slug}`}>{post.category_name}</Link> : <span>文章</span>}
            </div>
            <h1 className="article__title">{post.title}</h1>
            {post.summary && <p className="article__lede">{post.summary}</p>}
            <div className="article__meta">
              <span className="row"><Icon name="calendar" size={15} />{formatDate(post.published_at, 'cn')}</span>
              {site?.plugins?.readingTime && post.reading_time ? (
                <span className="row"><Icon name="clock" size={15} />约 {post.reading_time} 分钟</span>
              ) : null}
              <span className="row"><Icon name="eye" size={15} />{formatNumber(post.view_count)} 次阅读</span>
              <span className="row"><Icon name="type" size={15} />{formatNumber(post.word_count)} 字</span>
            </div>
            {post.tags?.length > 0 && (
              <div className="row wrap article__tags">
                {post.tags.map((t) => (
                  <Link key={t.id} to={`/?tag=${encodeURIComponent(t.slug)}`} className="chip">#{t.name}</Link>
                ))}
              </div>
            )}
          </header>

          {post.cover_image && (
            <figure className="article__cover">
              <img src={post.cover_image} alt="" loading="lazy" />
            </figure>
          )}

          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

          <footer className="article__foot">
            {site?.features?.postLikes !== false && site?.plugins?.likes !== false && (
              <button className={`like-btn${liked ? ' is-liked' : ''}`} onClick={onLike} aria-pressed={liked}>
                <Icon name="heart" size={20} />
                <span>{liked ? '已喜欢' : '喜欢'}</span>
                <strong>{likeCount}</strong>
              </button>
            )}
            <div className="article__share">
              <span className="faint">分享</span>
              <button
                className="icon-btn" title="复制链接"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(window.location.href); } catch (_) {}
                }}
              >
                <Icon name="copy" size={16} />
              </button>
              <a className="icon-btn" title="邮件" href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(window.location.href)}`}>
                <Icon name="mail" size={16} />
              </a>
            </div>
          </footer>

          <nav className="article-nav">
            {prev ? (
              <Link to={`/post/${encodeURIComponent(prev.slug)}`} className="article-nav__item card card--link">
                <span className="eyebrow">更新一篇</span>
                <strong>{prev.title}</strong>
              </Link>
            ) : <span />}
            {next ? (
              <Link to={`/post/${encodeURIComponent(next.slug)}`} className="article-nav__item card card--link">
                <span className="eyebrow">更早一篇</span>
                <strong>{next.title}</strong>
              </Link>
            ) : <span />}
          </nav>

          {related?.length > 0 && (
            <section className="related">
              <h2 className="section-title">相关阅读</h2>
              <div className="related__grid">
                {related.map((r) => (
                  <Link key={r.id} to={`/post/${encodeURIComponent(r.slug)}`} className="related__item card card--link">
                    <span className="faint">{formatDate(r.published_at, 'short')}</span>
                    <strong>{r.title}</strong>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {site?.plugins?.comments && post.allow_comment ? (
            <CommentSection postId={post.id} postSlug={post.slug} />
          ) : null}
        </article>

        {showToc && (
          <aside className="toc">
            <p className="eyebrow">目录</p>
            <nav>
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`toc__link toc__link--h${item.level}${activeToc === item.id ? ' is-active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
