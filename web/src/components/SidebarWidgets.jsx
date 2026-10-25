import { useState } from 'react';
import { useHotboard, useWeather } from '../hooks/useUapi';
import { Icon } from './Icon';

/** 热榜：可切换平台 */
const PLATFORMS = [
  ['zhihu', '知乎'], ['weibo', '微博'], ['bilibili', 'B站'],
  ['douyin', '抖音'], ['juejin', '掘金'], ['v2ex', 'V2EX'],
];

export function HotboardWidget({ defaultType = 'zhihu', enabled = true }) {
  const [type, setType] = useState(defaultType);
  const { data, loading } = useHotboard(type, enabled);

  if (!enabled) return null;

  return (
    <div className="card sidebar-widget">
      <div className="widget-head">
        <h3 className="sidebar-widget__title">热榜</h3>
        <select
          className="widget-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="选择平台"
        >
          {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading && !data ? (
        <div className="widget-loading">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 14, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      ) : data?.items?.length ? (
        <ol className="hot-list">
          {data.items.slice(0, 10).map((it, i) => (
            <li key={i}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="hot-item">
                <span className={`hot-rank${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
                <span className="hot-title">{it.title}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="faint" style={{ margin: 0, fontSize: '0.82rem' }}>暂无数据</p>
      )}
    </div>
  );
}

/** 天气 */
export function WeatherWidget({ city, enabled = true }) {
  const data = useWeather(city, enabled);
  if (!enabled || !data) return null;

  return (
    <div className="card sidebar-widget weather-widget">
      <div className="weather-main">
        <div>
          <p className="eyebrow">天气</p>
          <p className="weather-city">{data.city}</p>
        </div>
        <div className="weather-temp">
          <span className="weather-value">{data.temperature}</span>
          <span className="weather-unit">°C</span>
        </div>
      </div>
      <div className="weather-meta">
        <span>{data.weather}</span>
        {data.wind && <span>{data.wind}</span>}
        {data.humidity != null && <span>湿度 {data.humidity}%</span>}
      </div>
      {data.reportTime && <p className="weather-time faint">{data.reportTime}</p>}
    </div>
  );
}
