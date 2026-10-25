import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 顶部路由加载条
 * 路由变化时出现一条流动的进度条，加载完成后淡出。
 * 纯 CSS 动画，不用定时器追踪真实进度，避免误导。
 */
export default function RouteLoading() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 620);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!visible) return null;
  return <div className="route-progress" aria-hidden="true" />;
}
