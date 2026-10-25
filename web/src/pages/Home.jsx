import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import PostCard from '../components/PostCard';
import { Icon } from '../components/Icon';
import SiteContext from '../context/SiteContext';
import { formatDate } from '../lib/format';
import SayingBar from '../components/SayingBar';
import DailyWallpaper from '../components/DailyWallpaper';
import { HotboardWidget, WeatherWidget } from '../components/SidebarWidgets';
import { CAN_TRANSITION } from '../lib/viewTransition';

export default function Home() {
  const { site } = SiteContext.useSite();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const tagFilter = params.get('tag');
  const categoryFilter = params.get('category');
  const keyword = params.get('q');
  const [posts, setPosts] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    let alive = true;
    setPosts(null);
    setError(null);
    api.get('/posts', {
      page,
      pageSize: site?.frontend?.postsPerPage || 8,
      tag: tagFilter || undefined,
      category: categoryFilter || undefined,
      q: keyword || undefined,
    })
      .then(({ data, meta: m }) => { if (alive) { setPosts(data); setMeta(m); } })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [page, tagFilter, categoryFilter, keyword, site?.frontend?.postsPerPage]);

  useEffect(() => {
    api.get('/tags').then(({ data }) => setTags(data || [])).catch(() => {});
  }, []);

  const pinning = !tagFilter && !categoryFilter && !keyword;
  const pinned = posts?.filter((p) => p.is_pinned) || [];
  const featured = pinning && page === 1 ? pinned[0] || posts?.[0] : null;
  const rest = featured ? posts.filter((p) => p.id !== featured.id) : posts || [];

  const changePage = (next) => {
    const q = {};
    if (tagFilter) q.tag = tagFilter;
    if (categoryFilter) q.category = categoryFilter;
    if (keyword) q.q = keyword;
    if (next > 1) q.page = next;
    setParams(q);
  };

  return (
    <div className="home">
      <section className="hero container rise">
        <div className="hero__main">
          <p className="eyebrow">Refraction · Notes &amp; Engineering</p>
          <h1 className="hero__title">
            {site?.frontend?.title || '折光日志'}
            <span className="hero__dot" aria-hidden="true" />
          </h1>
          <p className="hero__desc">{site?.frontend?.description}</p>
          <SayingBar enabled={!!site?.uapi?.enabled && site?.uapi?.features?.saying !== false} />
          <div className="hero__actions">
            <a className="btn btn--solid" href="#posts">开始阅读<Icon name="arrow-right" size={16} /></a>
            {site?.plugins?.rss && (
              <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="btn" to="/archive">全部归档<Icon name="list" size={16} /></Link>
            )}
          </div>
        </div>
        <aside className="hero__side card">
          <h3 className="hero__side-title">站点数据</h3>
          <dl className="stats-grid">
            <div><dt>文章</dt><dd>{site?.stats?.posts ?? '—'}</dd></div>
            <div><dt>标签</dt><dd>{site?.stats?.tags ?? '—'}</dd></div>
            <div><dt>分类</dt><dd>{site?.stats?.categories ?? '—'}</dd></div>
            <div><dt>评论</dt><dd>{site?.stats?.comments ?? '—'}</dd></div>
          </dl>
          <div className="hero__side-foot faint">
            <Icon name="calendar" size={14} /><span>更新于 {formatDate(new Date(), 'cn')}</span>
          </div>
        </aside>
      </section>

      {(tagFilter || categoryFilter || keyword) && (
        <div className="container tag-banner">
          <span className="muted">筛选条件</span>
          {tagFilter && <span className="chip chip--accent">标签: {tagFilter}</span>}
          {categoryFilter && <span className="chip chip--accent">分类: {categoryFilter}</span>}
          {keyword && <span className="chip chip--accent">关键词: {keyword}</span>}
          <button className="btn btn--ghost" onClick={() => setParams({})}>清除筛选</button>
        </div>
      )}

      <section id="posts" className="container home__grid">
        <div className="home__main">
          {error && <div className="alert">{error}</div>}
          {!posts && <PostSkeletons />}

          {posts && posts.length === 0 && (
            <div className="empty card">
              <Icon name="book" size={28} />
              <p>{tagFilter || categoryFilter || keyword ? '没有符合条件的文章。' : '还没有文章。去管理端写下第一篇吧。'}</p>
            </div>
          )}

          {featured && (
            <div className="home__featured rise">
              <PostCard post={featured} featured index={0} />
            </div>
          )}

          <div className="post-list">
            {rest.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
          </div>

          {meta && meta.totalPages > 1 && (
            <nav className="pager" aria-label="分页">
              <button
                className="btn" disabled={!meta.hasPrev}
                onClick={() => changePage(page - 1)}
              >
                <Icon name="arrow-left" size={16} />上一页
              </button>
              <span className="pager__info faint">{page} / {meta.totalPages}</span>
              <button
                className="btn" disabled={!meta.hasNext}
                onClick={() => changePage(page + 1)}
              >
                下一页<Icon name="arrow-right" size={16} />
              </button>
            </nav>
          )}
        </div>

        <aside className="home__aside">
          <DailyWallpaper enabled={!!site?.uapi?.enabled && site?.uapi?.features?.bingWallpaper !== false} />
          <WeatherWidget city={site?.uapi?.city} enabled={!!site?.uapi?.enabled && !!site?.uapi?.features?.weather} />
          <HotboardWidget
            defaultType={site?.uapi?.hotboardType || 'zhihu'}
            enabled={!!site?.uapi?.enabled && !!site?.uapi?.features?.hotboard}
          />

          <div className="card sidebar-widget">
            <h3 className="sidebar-widget__title">标签云</h3>
            <div className="tag-cloud">
              {tags.slice(0, 18).map((t) => (
                <Link
                  key={t.id}
                  to={`/?tag=${encodeURIComponent(t.slug)}`}
                  className={`chip${tagFilter === t.slug ? ' chip--accent' : ''}`}
                  style={{ fontSize: `${Math.min(1, 0.76 + t.post_count * 0.02)}rem` }}
                >
                  {t.name}<span className="faint" style={{ opacity: 0.6 }}>{t.post_count}</span>
                </Link>
              ))}
              {!tags.length && <p className="faint">暂无标签</p>}
            </div>
          </div>

          <div className="card sidebar-widget sidebar-widget--author">
            {site?.frontend?.avatar && <img className="avatar" src={site.frontend.avatar} alt="" />}
            <h3>{site?.frontend?.author}</h3>
            <p className="muted">{site?.frontend?.authorBio}</p>
            <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="btn btn--ghost" to="/p/about">关于我<Icon name="arrow-right" size={15} /></Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

function PostSkeletons() {
  return (
    <div className="post-list" aria-busy="true" aria-label="加载中">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-card card">
          <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
          <div style={{ padding: 18 }}>
            <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
