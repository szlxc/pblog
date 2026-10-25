import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { formatDate } from '../lib/format';

/** 独立页面渲染（关于 / 友链 / 自定义页面），可附带友链列表 */
export default function PageView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [links, setLinks] = useState([]);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.get(`/pages/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!alive) return;
        setState({ status: 'ready', ...data });
        document.title = `${data.page.title}`;
      })
      .catch((e) => alive && setState({ status: 'error', message: e.message }));
    if (slug === 'links') api.get('/links').then(({ data }) => alive && setLinks(data || [])).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  if (state.status === 'loading') {
    return <div className="container--reading article-wrap"><div className="skeleton" style={{ height: 200, borderRadius: 16 }} /></div>;
  }
  if (state.status === 'error') {
    return (
      <div className="container empty-wrap">
        <div className="empty card">
          <Icon name="book" size={28} />
          <h2>页面不存在</h2>
          <p className="muted">{state.message}</p>
          <button className="btn btn--solid" onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container--reading article-wrap page-view">
      <header className="page-head rise">
        <p className="eyebrow">Page</p>
        <h1>{state.page.title}</h1>
        <p className="faint">更新于 {formatDate(state.page.updated_at, 'cn')}</p>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: state.html }} />

      {links.length > 0 && (
        <section className="links-grid">
          {links.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="link-card card card--link">
              {l.avatar ? <img src={l.avatar} alt="" className="link-card__avatar" loading="lazy" /> : (
                <span className="link-card__avatar link-card__avatar--gen">{(l.name || '?').charAt(0)}</span>
              )}
              <div>
                <strong>{l.name}</strong>
                <p className="faint">{l.description || l.url}</p>
              </div>
              <Icon name="external" size={15} />
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
