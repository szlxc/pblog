import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { StatusTag, EmptyState } from '../components/ui';

const fmt = (n) => new Intl.NumberFormat('zh-CN').format(Number(n) || 0);
const shortDate = (d) => (d ? String(d).slice(5, 10) : '');

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data: d }) => setData(d)).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel"><div className="panel__body">加载失败：{error}</div></div>;
  if (!data) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;

  const c = data.counters;
  const stats = [
    { label: '已发布文章', value: c.posts, sub: `${c.drafts} 篇草稿 · ${c.scheduled} 篇定时`, icon: 'file', to: '/posts' },
    { label: '总阅读量', value: c.views, sub: `今日 ${fmt(c.todayViews || 0)} 次 · 累计点赞 ${fmt(c.likes)}`, icon: 'eye' },
    { label: '评论', value: c.comments, sub: c.pendingComments ? `${c.pendingComments} 条待审核` : '全部已处理', icon: 'message', to: '/comments' },
    { label: '媒体文件', value: c.media, sub: `${c.tags} 个标签`, icon: 'image', to: '/media' },
  ];

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>概览</h2>
          <p>站点运行状态与最近动态</p>
        </div>
        <Link className="btn" to="/posts/new"><Icon name="plus" size={15} />新建文章</Link>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat__label"><Icon name={s.icon} size={14} />{s.label}</div>
            <div className="stat__value">{fmt(s.value)}</div>
            <div className="stat__sub">{s.sub}</div>
            {s.to && <Link to={s.to} style={{ position: 'absolute', inset: 0 }} aria-label={s.label} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="panel">
          <div className="panel__head"><h3>近 14 天访问趋势</h3></div>
          <div className="panel__body">
            <TrafficChart series={data.traffic} />
          </div>
        </div>
        <div className="panel">
          <div className="panel__head"><h3>分类分布</h3></div>
          <div className="panel__body">
            {data.categoryDist.length ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {data.categoryDist.map((cat) => {
                  const max = Math.max(...data.categoryDist.map((x) => x.n), 1);
                  return (
                    <div key={cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                        <span>{cat.name}</span><span className="num">{cat.n}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                        <div style={{ width: `${(cat.n / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>暂无分类</p>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>最近更新的文章</h3>
            <Link className="btn btn--ghost btn--sm" to="/posts" style={{ marginLeft: 'auto' }}>全部</Link>
          </div>
          <div className="panel__body panel__body--flush">
            {data.recentPosts.map((p) => (
              <div key={p.id} className="comment-row">
                <div className="comment-row__head">
                  <Link to={`/posts/${p.id}`} style={{ fontWeight: 550 }}>{p.title}</Link>
                  <StatusTag status={p.status} />
                  <span className="faint" style={{ marginLeft: 'auto' }}>{shortDate(p.updated_at)}</span>
                </div>
              </div>
            ))}
            {!data.recentPosts.length && <EmptyState title="还没有文章" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>热门文章</h3>
          </div>
          <div className="panel__body panel__body--flush">
            {data.topPosts.map((p, i) => (
              <div key={p.id} className="comment-row">
                <div className="comment-row__head">
                  <span className="num" style={{ width: 18, color: i < 3 ? 'var(--accent)' : undefined }}>{i + 1}</span>
                  <Link to={`/posts/${p.id}`}>{p.title}</Link>
                  <span className="faint" style={{ marginLeft: 'auto' }}>{fmt(p.view_count)} 次</span>
                </div>
              </div>
            ))}
            {!data.topPosts.length && <EmptyState title="暂无数据" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>最新评论</h3>
            <Link className="btn btn--ghost btn--sm" to="/comments" style={{ marginLeft: 'auto' }}>管理</Link>
          </div>
          <div className="panel__body panel__body--flush">
            {data.recentComments.map((cm) => (
              <div key={cm.id} className="comment-row">
                <div className="comment-row__head">
                  <strong>{cm.author_name}</strong>
                  <StatusTag status={cm.status} />
                  <span className="faint">{shortDate(cm.created_at)}</span>
                </div>
                <p className="comment-row__text" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {cm.content}
                </p>
              </div>
            ))}
            {!data.recentComments.length && <EmptyState icon="message" title="还没有评论" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrafficChart({ series }) {
  if (!series?.length) return <p className="muted">暂无访问数据</p>;
  const W = 640;
  const H = 200;
  const pad = { l: 28, r: 8, t: 12, b: 24 };
  const max = Math.max(...series.map((s) => s.views), 4);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const bw = innerW / series.length;

  const ticks = [0, Math.round(max / 2), max];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近 14 天访问量柱状图" preserveAspectRatio="none">
      {ticks.map((t) => {
        const y = pad.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line className="chart__axis" x1={pad.l} x2={W - pad.r} y1={y} y2={y} strokeDasharray={t === 0 ? '' : '3 4'} />
            <text className="chart__label" x={pad.l - 6} y={y + 3} textAnchor="end">{t}</text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const h = Math.max(1, (s.views / max) * innerH);
        return (
          <g key={s.day}>
            <rect
              className="chart__bar"
              x={pad.l + i * bw + bw * 0.22}
              y={pad.t + innerH - h}
              width={bw * 0.56}
              height={h}
              rx="2"
            >
              <title>{`${s.day}：${s.views} 次`}</title>
            </rect>
            {(i % 2 === 0 || i === series.length - 1) && (
              <text className="chart__label" x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">{shortDate(s.day)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
