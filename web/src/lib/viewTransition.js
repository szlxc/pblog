/**
 * 安全的页面过渡包装
 *
 * 有些浏览器（或启用了「减少动画」的用户）不支持 View Transitions API，
 * 直接调用 navigate({ viewTransition: true }) 可能抛错并中断导航。
 * 这里做一个能力检测，不支持时退化为普通跳转。
 */
export function supportsViewTransition() {
  if (typeof document === 'undefined') return false;
  if (typeof document.startViewTransition !== 'function') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  } catch (_) {}
  return true;
}

/** 供组件判断是否传 viewTransition */
export const CAN_TRANSITION = (() => {
  try { return supportsViewTransition(); } catch (_) { return false; }
})();
