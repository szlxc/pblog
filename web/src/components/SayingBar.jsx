import { useEffect, useState } from 'react';
import { useSaying } from '../hooks/useUapi';

/**
 * 首页「一言」
 * 每天随机展示一句诗词 / 台词 / 名言，来自 UAPI。
 * 加载失败时静默不显示，不影响页面。
 */
export default function SayingBar({ enabled = true }) {
  const text = useSaying(enabled);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (text) requestAnimationFrame(() => setFade(true));
  }, [text]);

  if (!text) return null;

  return (
    <p className={`saying${fade ? ' is-in' : ''}`}>
      <span className="saying__quote" aria-hidden="true">“</span>
      {text}
      <span className="saying__quote" aria-hidden="true">”</span>
    </p>
  );
}
