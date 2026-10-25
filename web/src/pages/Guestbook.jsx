import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useMember } from '../context/MemberContext';
import SiteContext from '../context/SiteContext';
import { Icon } from '../components/Icon';
import DanmakuLayer from '../components/guestbook/DanmakuLayer';
import CommentTree from '../components/guestbook/CommentTree';
import ReplyModal from '../components/guestbook/ReplyModal';
import Composer from '../components/guestbook/Composer';
import ErrorBoundary from '../components/ErrorBoundary';

/** 默认外观（后端未配置时兜底） */
const DEFAULT_STYLE = {
  speed: 70,
  minFontSize: 14,
  maxFontSize: 26,
  colors: ['#e8edf2', '#6ee7b7', '#818cf8'],
  lanes: 8,
  maxOnScreen: 18,
  pauseSeconds: 5,
  showMood: true,
};

export default function Guestbook() {
  const { site } = SiteContext.useSite();
  const { member, status } = useMember();
  const style = useMemo(() => ({ ...DEFAULT_STYLE, ...(site?.guestbookStyle || {}) }), [site]);

  /* ---------- 数据 ---------- */
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  /* ---------- 交互状态 ---------- */
  const [hoveredId, setHoveredId] = useState(null);   // 悬停/点选，用于暂停
  const [expandedId, setExpandedId] = useState(null); // 展开树状面板
  const [replyCtx, setReplyCtx] = useState(null);     // { rootId, targetId }
  const [layoutInfo, setLayoutInfo] = useState({ rows: [], stage: { w: 0, h: 0 } });
  const [anchorBox, setAnchorBox] = useState(null);   // 被点弹幕的实时位置

  // 仅在内容真正变化时更新，避免「布局上报 → 重渲染 → 再上报」的死循环
  const handleLayout = useCallback((rows, stage) => {
    setLayoutInfo((prev) => {
      if (prev.rows === rows && prev.stage.w === stage.w && prev.stage.h === stage.h) return prev;
      return { rows, stage };
    });
  }, []);

  const enabled = site?.community?.guestbookEnabled !== false && site?.plugins?.guestbook !== false;
  const loggedIn = status === 'authed';

  /* ---------- 加载 ---------- */
  const load = useCallback(() => {
    api.get('/guestbook')
      .then(({ data }) => setItems(data || []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  /* ---------- 提示 ---------- */
  const flash = useCallback((text, ok = true) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 2400);
  }, []);

  /* ---------- 发布留言 ---------- */
  const submitMessage = useCallback(async ({ text, nickname, mood }) => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/guestbook', {
        content: text,
        nickname: loggedIn ? undefined : (nickname || undefined),
        mood,
      }, { auth: loggedIn ? 'member' : false });
      flash('留言已发布');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [loggedIn, flash, load]);

  /* ---------- 发送回复 ---------- */
  const submitReply = useCallback(async (text) => {
    if (!replyCtx) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/guestbook', {
        content: text,
        parentId: replyCtx.targetId,
      }, { auth: loggedIn ? 'member' : false });
      setReplyCtx(null);
      flash('回复已发布');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [replyCtx, loggedIn, flash, load]);

  /* ---------- 选中 / 暂停 ---------- */
  const toggleTree = useCallback((id, box) => {
    setExpandedId((cur) => {
      if (cur === id) { setAnchorBox(null); return null; }
      if (box) setAnchorBox(box);
      return id;
    });
  }, []);
  const handleHover = useCallback((id) => setHoveredId(id), []);
  const handleLeave = useCallback((id) => {
    setHoveredId((cur) => (cur === id ? null : cur));
  }, []);
  const handleReply = useCallback((targetId, rootId) => {
    setReplyCtx({ targetId, rootId });
  }, []);
  const closeTree = useCallback(() => { setExpandedId(null); setAnchorBox(null); }, []);

  const pausedIds = useMemo(() => {
    const s = new Set();
    if (hoveredId) s.add(hoveredId);
    if (expandedId) s.add(expandedId);
    return s;
  }, [hoveredId, expandedId]);

  if (!enabled) {
    return (
      <div className="container empty-wrap">
        <div className="empty card">
          <Icon name="message-square" size={28} />
          <h2>留言墙暂未开放</h2>
          <Link className="btn btn--solid" to="/">回到首页</Link>
        </div>
      </div>
    );
  }

  const expandedItem = items?.find((i) => i.id === expandedId) || null;

  // 树状面板的纵向占位，供弹幕避让（用弹幕实时位置，而非固定轨道）
  const expandedPanel = useMemo(() => {
    if (!expandedItem) return null;
    const row = layoutInfo.rows.find((r) => r.item.id === expandedItem.id);
    if (!row) return null;

    // 面板高度：根节点 + 每条回复（含多级）
    const replyCount = countReplies(expandedItem);
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const height = Math.min(Math.min(320, vh * 0.44), 140 + replyCount * 56);

    // 面板位置：优先用点击时记录的真实位置，回退到布局轨道
    const anchorTop = anchorBox ? anchorBox.top : row.top;
    const anchorH = anchorBox ? anchorBox.height : row.height;
    const below = anchorTop + anchorH + 10;
    const top = below + height <= vh - 20 ? below : Math.max(70, anchorTop - height - 10);

    return { lane: row.lane, top, height };
  }, [expandedItem, layoutInfo, anchorBox]);

  return (
    <div className="gb-page">
      <div className="gb-stage">
        <div className="gb-stage__bg" aria-hidden="true" />

        {!items && <div className="gb-loading faint">正在加载留言…</div>}

        {items && (
          <ErrorBoundary title="弹幕渲染出错">
          <DanmakuLayer
            items={items}
            style={style}
            pausedIds={pausedIds}
            expandedId={expandedId}
            panel={expandedPanel}
            onHover={handleHover}
            onLeave={handleLeave}
            onToggleTree={toggleTree}
            onReply={handleReply}
            onLayout={handleLayout}
          />
          </ErrorBoundary>
        )}

        {/* 树状面板 */}
        {expandedItem && (
          <TreeOverlay
            item={expandedItem}
            style={style}
            anchorBox={anchorBox}
            onClose={closeTree}
            onReply={handleReply}
          />
        )}

        <Composer loggedIn={loggedIn} busy={busy} onSubmit={submitMessage} feedback={feedback} />
      </div>

      {error && <p className="gb-error">{error}</p>}

      {replyCtx && items && (() => {
        const root = items.find((i) => i.id === replyCtx.rootId);
        if (!root) return null;
        const target = findNode(root, replyCtx.targetId);
        return (
          <ReplyModal
            root={root}
            replyTarget={target}
            loggedIn={loggedIn}
            busy={busy}
            onCancel={() => setReplyCtx(null)}
            onSubmit={submitReply}
          />
        );
      })()}
    </div>
  );
}

/** 树状面板定位：贴在被展开弹幕所在轨道的右侧 */
function TreeOverlay({ item, style, anchorBox, onClose, onReply }) {
  // 舞台尺寸：从 anchorBox 所在容器的宽度推断不可靠，用 window 内宽兜底
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const isMobile = vw < 640;
  const panelW = isMobile ? Math.min(vw - 24, 420) : Math.min(380, vw * 0.42);
  const panelMaxH = Math.min(320, vh * 0.44);

  // 默认（拿不到弹幕位置时）居中偏上
  let left = Math.max(12, (vw - panelW) / 2);
  let top = 120;
  let placement = 'below';

  if (anchorBox) {
    // 水平：与弹幕左缘对齐，右侧超界则左移
    left = anchorBox.left;
    if (left + panelW > vw - 12) left = vw - panelW - 12;
    if (left < 12) left = 12;

    // 垂直：弹幕正下方；下方不够则放上方
    const below = anchorBox.top + anchorBox.height + 10;
    if (below + panelMaxH <= vh - 20) {
      top = below;
      placement = 'below';
    } else {
      const above = anchorBox.top - panelMaxH - 10;
      if (above > 70) {
        top = above;
        placement = 'above';
      } else {
        top = Math.max(70, vh - panelMaxH - 20);
      }
    }
  }

  return (
    <CommentTree
      root={{
        item,
        left,
        top,
        placement,
        width: panelW,
        maxHeight: panelMaxH,
        showMood: style.showMood,
        color: style.colors[0],
      }}
      color={style.colors[0]}
      onClose={onClose}
      onReply={onReply}
    />
  );
}

/** 统计一条留言下的所有回复数量（含多级） */
function countReplies(node) {
  let n = 0;
  const stack = [...(node.replies || [])];
  while (stack.length) {
    const cur = stack.pop();
    n += 1;
    if (cur.replies) stack.push(...cur.replies);
  }
  return n;
}

/** 在回复树中按 id 查找节点 */
function findNode(root, id) {
  if (root.id === id) return root;
  const stack = [...(root.replies || [])];
  while (stack.length) {
    const n = stack.shift();
    if (n.id === id) return n;
    if (n.replies) stack.push(...n.replies);
  }
  return null;
}
