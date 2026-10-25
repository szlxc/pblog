/**
 * 弹幕布局计算
 * 纯函数，不依赖 React，便于测试与复用。
 */

export const MOODS_FALLBACK = {
  happy: '开心', love: '喜欢', think: '思考', cool: '酷', sad: '难过',
};

export const UNIFORM_FONT = '"Inter","Noto Sans SC",system-ui,sans-serif';

/** 受控随机：同一 seed 得到同一结果，避免重渲染时跳动 */
export function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 把文本按最大宽度折成多行（贪心，中英文混排） */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let cur = '';
  for (const ch of Array.from(text)) {
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/**
 * 计算单条弹幕的尺寸
 * @returns {{ lines, width, minWidth, height }}
 */
function measureBubble(ctx, text, fontSize, maxContentW) {
  ctx.font = `${fontSize}px ${UNIFORM_FONT}`;
  const lines = wrapText(ctx, text, maxContentW);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const contentW = Math.min(textW, maxContentW) + 28;   // 左右内边距共 28
  return {
    lines,
    // 气泡宽度 = 文字实际宽度，不再为按钮预留空位
    // （按钮是绝对定位在气泡外侧的，不需要占宽度）
    width: contentW,
    minWidth: contentW,
    height: lines.length * fontSize * 1.55 + 16,
  };
}

/**
 * 生成弹幕布局
 *
 * @param {Array}  items   留言列表
 * @param {object} style   后台配置（speed/lanes/colors/fontSize...）
 * @param {object} stage   { w, h } 舞台尺寸
 * @param {object} opts    { hoveredId, expandedId } 用于动态避让
 * @returns {Array} 布局项数组
 */
export function buildLayout(items, style, stage, opts = {}) {
  const { lanes, minFontSize, maxFontSize, colors, speed, showMood } = style;
  const { w, h } = stage;
  if (!w || !h || !items?.length) return [];

  const isMobile = w < 640;
  const laneH = Math.max(isMobile ? 44 : 38, h / lanes);
  const maxBubbleW = isMobile ? w * 0.72 : w * 0.5;
  const maxContentW = maxBubbleW;

  const ctx = document.createElement('canvas').getContext('2d');
  const rnd = seededRandom(1337);

  // 每条轨道的累计占用时间
  const rows = Array.from({ length: lanes }, (_, i) => ({ i, lastEnd: 0 }));

  const out = [];
  let cursor = 0;

  items.forEach((item, idx) => {
    // 选最早空出的轨道
    rows.sort((a, b) => a.lastEnd - b.lastEnd);
    const lane = rows[0];

    const fontSize = Math.round(minFontSize + rnd() * Math.max(0, maxFontSize - minFontSize));
    const color = colors[(idx + Math.floor(fontSize)) % colors.length];

    const moodLabel = showMood && item.mood ? MOODS_FALLBACK[item.mood] : '';
    const text = [item.content || '', moodLabel].filter(Boolean).join(' · ');

    const { lines, width, minWidth, height } = measureBubble(ctx, text, fontSize, maxContentW);
    const duration = ((w + width) / speed) * 1000;
    const startDelay = Math.max(0, lane.lastEnd - cursor + rnd() * (isMobile ? 120 : 300));

    lane.lastEnd = cursor + startDelay + duration;

    out.push({
      item,
      lane: lane.i,
      top: lane.i * laneH + laneH * 0.12,
      laneH,
      fontSize,
      color,
      delay: cursor + startDelay,
      duration,
      width,
      minWidth,
      height,
      lines,
      // 宽气泡把操作按钮放左侧，避免超出屏幕
      toolsLeft: width > w * 0.42,
    });

    cursor += isMobile ? 90 : 60;
  });

  return out;
}

/**
 * 计算避让偏移
 * 展开树状面板时，面板覆盖区域内的弹幕需要让开。
 *
 * @param {object}  layout   布局项
 * @param {object}  panel    { side: 'left'|'right', width }
 * @param {object}  stage    { w, h }
 * @param {number}  expandedId 正在展开的弹幕 id
 * @param {object}  timeNow  当前动画时间（毫秒）
 * @returns {{ dy:number, faded:boolean }}
 */
export function computeAvoid(layoutRow, panel, stage, expandedId, timeNow = 0) {
  if (!expandedId || !panel) return { dy: 0, faded: false };

  // 只有同轨道、且不是被展开的那条，才需要避让
  const item = layoutRow.item;
  if (item.id === expandedId) return { dy: 0, faded: false };

  const sameLane = layoutRow.lane === panel.lane;
  if (!sameLane) return { dy: 0, faded: false };

  // 面板占据的高度 = 面板估算高度 + 间距
  const push = panel.height + 12;

  // 在面板上方的向上让，在面板下方的向下让
  const dy = layoutRow.top < panel.top ? -push : push;
  return { dy, faded: false };
}
