import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 点击特效（蔚蓝档案风格）
 *
 * 使用开源项目 ba-click-fx（MIT 许可）
 * https://github.com/CialloKing/ba-click-fx
 *
 * 关键实现说明（都是踩过的坑，改动前请先读完）：
 *
 * 1. 覆盖层定位
 *    库在 `dom-backdrop` 合成模式下，会把 canvas 层设为 position:absolute 挂在
 *    document.body 上。body 的高度是整篇文档的高度（>2000px），
 *    absolute 层随文档滚动，页面滚动/切页后特效会被顶栏附近的裁切边界切掉。
 *    这里在实例创建后把库创建的覆盖层强制改成 fixed，并让 body 不产生裁切。
 *
 * 2. 页面过渡（View Transitions）
 *    原生 View Transitions 会对「旧页面」拍快照再合成新页面。
 *    特效层是 fixed + z-index 上限的独立层，不属于快照树里的任何一方，
 *    过渡进行中它会被新页面的合成结果盖掉 / 裁掉，表现为「点顶栏切页时特效截断」。
 *    正确做法：过渡开始前暂停并清屏，过渡结束后恢复。
 *
 * 3. 拖尾
 *    库默认 drag 才出拖尾，`trailAlways` 让「移动即出」。
 *    但浏览器一旦接管手势就会发 pointercancel 中断拖尾（移动端尤其明显），
 *    所以这里显式设置 touchAction，并在自己这层拦截 dragstart /
 *    selectstart / contextmenu，避免拖动被识别成「选中文字 / 拖拽图片」。
 */

const LAYER_SELECTOR = 'body > div[aria-hidden="true"]';

/** 把库创建的覆盖层固定到视口，避免被文档高度的裁切影响 */
function pinOverlayToViewport() {
  const layers = document.querySelectorAll(LAYER_SELECTOR);
  layers.forEach((layer) => {
    layer.style.setProperty('position', 'fixed', 'important');
    layer.style.setProperty('inset', '0', 'important');
    layer.style.setProperty('width', '100%', 'important');
    layer.style.setProperty('height', '100%', 'important');
    // 注意：这里千万不要设 view-transition-name: none。
    // 特效层需要以独立分组参与页面过渡（见 view-transition.css），
    // 设成 none 会让它退回普通 body 子元素，过渡期间被新页面快照盖住。
    layer.querySelectorAll('canvas').forEach((c) => {
      c.style.setProperty('position', 'fixed', 'important');
      c.style.setProperty('inset', '0', 'important');
      c.style.setProperty('width', '100%', 'important');
      c.style.setProperty('height', '100%', 'important');
    });
  });
}

export default function ClickEffect({
  enabled = true,
  themeColor = '#6ee7b7',
  trailAlways = false,
}) {
  const fxRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return undefined;

    let reduce = false;
    try {
      reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}
    if (reduce) return undefined;

    let destroyed = false;
    let fx = null;
    let pinTimer = null;

    (async () => {
      try {
        const mod = await import('ba-click-fx');
        if (destroyed) return;
        const BAClickFX = mod.BAClickFX || mod.default;
        if (!BAClickFX) return;

        fx = new BAClickFX({
          // 普通网页推荐组合：透明覆盖层 + DOM 近似加色
          outputCompositing: 'browser-overlay',
          hostCompositing: 'screen',
          hostCompositingSurface: 'dom-backdrop',
          // auto 保留原生滚动；库会在需要时自行阻止被接管方向的默认手势
          touchAction: 'auto',
          clickEnabled: true,
          trailEnabled: true,
          trailAlways,
          // 不限频采样，拖尾更跟手
          inputSamplingRate: 0,
        });

        const hex = String(themeColor).replace('#', '');
        if (/^[0-9a-fA-F]{6}$/.test(hex)) fx.setThemeColor(`#${hex}`);

        fxRef.current = fx;

        // 覆盖层是异步创建的（要等后端探测），轮询几次直到出现
        let tries = 0;
        const pinNow = () => {
          if (destroyed) return;
          pinOverlayToViewport();
          if (++tries < 24) pinTimer = window.setTimeout(pinNow, 120);
        };
        pinNow();

        /* ---------------- 诊断开关（?fxdebug=1） ----------------
           把实例挂到 window，方便在控制台直接查看真实生效的配置：
             fx.getConfig()            当前配置 + 实际渲染后端
             fx.updateConfig({...})    现场改配置验证
             fx.getFxConfig()          完整特效参数
           只在带参数时挂，不影响正常使用。 */
        let debug = false;
        try {
          debug = new URLSearchParams(location.search).get('fxdebug') === '1';
        } catch (_) {}
        if (debug) {
          window.__fx = fx;
          console.info('[ClickEffect] 调试模式已开启');
          console.info('  当前配置:', fx.getConfig());
          console.info('  提示: fx.getConfig() / fx.updateConfig({trailAlways:true}) / fx.clear()');
        }

        /* ---------------- 输入防抖：别让浏览器把拖动理解成别的手势 ---------------- */
        const isEditable = (t) => !!t?.closest?.('input, textarea, select, [contenteditable="true"], .prose');

        const onDragStart = (e) => {
          if (isEditable(e.target)) return;
          e.preventDefault();
        };
        const onSelectStart = (e) => {
          if (isEditable(e.target)) return;
          // 拖动期间禁止文本选择，否则 pointermove 会被 selection 打断
          if (document.documentElement.classList.contains('fx-dragging')) e.preventDefault();
        };

        document.addEventListener('dragstart', onDragStart, true);
        document.addEventListener('selectstart', onSelectStart, true);

        const onPointerDown = () => document.documentElement.classList.add('fx-dragging');
        const onPointerUp = () => document.documentElement.classList.remove('fx-dragging');
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);

        /* ---------------- 页面过渡：过渡期间暂停，过渡结束恢复 ---------------- */
        const pause = () => { try { fx?.setPaused(true, { clear: true }); } catch (_) {} };
        const resume = () => { try { fx?.setPaused(false); } catch (_) {} };

        // pageswap 在新的 View Transition 开始前触发
        const onPageSwap = () => pause();
        const onPageReveal = () => {
          pinOverlayToViewport();
          // 等新页面合成完成再恢复，否则特效会被新页面的首帧盖掉
          window.setTimeout(resume, 120);
        };
        window.addEventListener('pageswap', onPageSwap);
        window.addEventListener('pagereveal', onPageReveal);

        fx._cleanup = () => {
          document.removeEventListener('dragstart', onDragStart, true);
          document.removeEventListener('selectstart', onSelectStart, true);
          window.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('pointerup', onPointerUp, true);
          window.removeEventListener('pointercancel', onPointerUp, true);
          window.removeEventListener('pageswap', onPageSwap);
          window.removeEventListener('pagereveal', onPageReveal);
          document.documentElement.classList.remove('fx-dragging');
          if (pinTimer) window.clearTimeout(pinTimer);
        };
      } catch (e) {
        console.warn('[ClickEffect] 初始化失败', e?.message);
      }
    })();

    return () => {
      destroyed = true;
      try { fx?._cleanup?.(); } catch (_) {}
      try { fx?.destroy(); } catch (_) {}
      fxRef.current = null;
    };
  }, [enabled, trailAlways]);

  // 主题色热更新，不重建实例
  useEffect(() => {
    const fx = fxRef.current;
    if (!fx) return;
    const hex = String(themeColor).replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      try { fx.setThemeColor(`#${hex}`); } catch (_) {}
    }
  }, [themeColor]);

  // 路由切换：清掉上一页残留的轨迹，并重新校正覆盖层位置
  useEffect(() => {
    pinOverlayToViewport();
    const t = window.setTimeout(() => {
      pinOverlayToViewport();
      try { fxRef.current?.clear(); } catch (_) {}
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return null;
}
