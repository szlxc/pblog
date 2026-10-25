import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { buildLayout, MOODS_FALLBACK } from './layout';

/**
 * 弹幕层
 * - 负责测量舞台尺寸、计算布局、渲染气泡
 * - 树状面板展开时，同轨道弹幕自动让位（transform 过渡），收起后归位
 */
export default function DanmakuLayer({
  items,
  style,
  pausedIds,
  expandedId,
  panel,            // { lane, top, height, side } | null
  onHover,
  onLeave,
  onToggleTree,
  onReply,
  onLayout,
}) {
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  /* ---------- 尺寸测量 ---------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- 布局 ---------- */
  const layout = useMemo(
    () => buildLayout(items, style, stage),
    [items, style, stage.w, stage.h] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 把布局与舞台尺寸交给父组件（仅在 layout 真正变化时上报，避免无限循环）
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  const lastLayoutRef = useRef(null);
  useEffect(() => {
    if (lastLayoutRef.current === layout) return;
    lastLayoutRef.current = layout;
    onLayoutRef.current?.(layout, stage);
  }, [layout, stage]);

  /* ---------- 避让计算 ---------- */
  /**
   * 避让：面板是一个纵向的矩形区域（从 panel.top 到 panel.top + panel.height）。
   * 被它覆盖到的弹幕都要让开——
   *   - 位于面板上方边缘的，向上推
   *   - 位于面板中部及以下的，向下推
   * 收起面板时 panel 变成 null，所有位移归零（CSS transition 自动回弹）。
   */
  const shifts = useMemo(() => {
    if (!expandedId || !panel) return {};

    const gap = 12;
    const stageH = stage.h;
    const panelTop = panel.top;
    const panelBottom = panel.top + panel.height;
    const map = {};

    for (const row of layout) {
      // 被展开的那条本身不移（它就在面板旁）
      if (row.item.id === expandedId) continue;

      const itemTop = row.top;
      const itemBottom = row.top + row.height;

      // 与面板纵向区间不重叠 → 不需要让
      if (itemBottom < panelTop || itemTop > panelBottom) continue;

      // 距离面板更近的一侧优先：上半部分往上，下半部分往下
      const center = itemTop + row.height / 2;
      const panelCenter = panelTop + panel.height / 2;
      const preferUp = center < panelCenter;

      // 推到面板上边界之上 / 下边界之下所需位移
      const upAmount = -(itemTop - panelTop + gap);
      const downAmount = (panelBottom - itemTop + gap);

      let dy = preferUp ? upAmount : downAmount;

      // 边界保护：不推出舞台顶部/底部
      const nextTop = itemTop + dy;
      if (nextTop < 0) dy = -itemTop;
      const nextBottom = nextTop + row.height;
      if (nextBottom > stageH) dy = Math.max(0, stageH - itemTop - row.height);

      map[row.item.id] = dy;
    }
    return map;
  }, [layout, expandedId, panel, stage.h]);

  return (
    <div className="gb-danmaku" ref={stageRef} onClick={() => onToggleTree?.(null)}>
      {layout.map((row) => (
        <Bubble
          key={row.item.id}
          row={row}
          paused={pausedIds.has(row.item.id) || expandedId === row.item.id}
          shiftY={shifts[row.item.id] || 0}
          onHover={onHover}
          onLeave={onLeave}
          onToggleTree={onToggleTree}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

/* ============================================================
 * 单条弹幕气泡
 * ============================================================ */
function Bubble({ row, paused, shiftY, onHover, onLeave, onToggleTree, onReply }) {
  /** 取气泡（外层 .gb-lane）在舞台坐标系中的位置 */
  const captureBox = (e) => {
    const lane = e.currentTarget.closest('.gb-lane') || e.currentTarget;
    const r = lane.getBoundingClientRect();
    const stage = lane.closest('.gb-danmaku')?.getBoundingClientRect();
    if (!stage) return { left: r.left, top: r.top, width: r.width, height: r.height };
    // 转成相对舞台的坐标
    return {
      left: r.left - stage.left,
      top: r.top - stage.top,
      width: r.width,
      height: r.height,
    };
  };

  const { item, lines, fontSize, color, top, delay, duration, width, minWidth, toolsLeft } = row;
  const hasReplies = (item.replies || []).length > 0;

  return (
    <div
      className="gb-lane"
      style={{
        top: `${top}px`,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationPlayState: paused ? 'paused' : 'running',
      }}
    >
      {/* 内层负责避让位移，与外层滚动动画互不干扰 */}
      <div
        className="gb-shift"
        style={{ transform: `translateY(${shiftY}px)` }}
      >
        <div
          className={`gb-item${paused ? ' is-paused' : ''}${hasReplies ? ' has-branch' : ''}${toolsLeft ? ' tools-left' : ''}`}
          style={{
            fontSize: `${fontSize}px`,
            color,
            width: `${width}px`,
            minWidth: `${minWidth}px`,
          }}
          onMouseEnter={() => onHover(item.id)}
          onMouseLeave={() => onLeave(item.id)}
          onClick={(e) => {
            e.stopPropagation();
            onToggleTree(item.id, captureBox(e));
          }}
        >
      <span className="gb-item__text">
        {lines.map((line, i) => (
          <span key={i} className="gb-item__line">{line}</span>
        ))}
      </span>

      <span className="gb-item__tools">
        {hasReplies && (
          <button
            className="gb-item__tool"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTree(item.id, captureBox(e));
            }}
            title={`${item.replies.length} 条回复`}
          >
            <Icon name="message" size={12} />
            {item.replies.length}
          </button>
        )}
        <button
          className="gb-item__tool gb-item__tool--primary"
          onClick={(e) => { e.stopPropagation(); onReply(item.id, item.id); }}
          title="回复"
        >
          <Icon name="reply" size={12} />
          回复
        </button>
      </span>
        </div>
      </div>
    </div>
  );
}

export { MOODS_FALLBACK };
