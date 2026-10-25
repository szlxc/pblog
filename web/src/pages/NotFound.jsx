import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container empty-wrap">
      <div className="empty card">
        <p className="eyebrow">Error 404</p>
        <h1 className="notfound__code">404</h1>
        <p className="muted">这个页面像是被折进了别的维度。</p>
        <Link className="btn btn--solid" to="/">回到首页</Link>
      </div>
    </div>
  );
}
