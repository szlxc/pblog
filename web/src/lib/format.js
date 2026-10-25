/** 日期与数字格式化 */

export function formatDate(input, style = 'date') {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (style === 'short') return `${m}-${day}`;
  if (style === 'iso') return `${y}-${m}-${day}`;
  if (style === 'cn') return `${y} 年 ${m} 月 ${day} 日`;
  return `${y}-${m}-${day}`;
}

export function relativeTime(input) {
  if (!input) return '';
  const diff = Date.now() - new Date(input).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}

export function formatNumber(n) {
  const num = Number(n) || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

export const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-');
  return `${y} 年 ${Number(m)} 月`;
};
