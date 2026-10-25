import { Icon } from '../Icon';
import { MOODS_FALLBACK } from './layout';

/**
 * 树状回复面板
 * 任意层级递归渲染，每条回复都可继续回复。
 */
export default function CommentTree({ root, color, onClose, onReply }) {
  const node = root?.item;
  // 结构不完整时安全退出，避免整页崩溃
  if (!node) {
    console.warn('[CommentTree] root.item 缺失', root);
    return null;
  }

  return (
    <div
      className={`gb-tree${root.placement === 'above' ? ' gb-tree--above' : ''}`}
      style={{
        left: `${root.left}px`,
        top: `${root.top}px`,
        width: `${root.width}px`,
        maxHeight: `${root.maxHeight || 340}px`,
        borderColor: color,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 连接线：指向弹幕 */}
      <span
        className="gb-tree__connector"
        style={{ borderColor: color, left: `${Math.min(root.width / 2, 40)}px` }}
      />

      {/* 根：被点开的留言 */}
      <div className="gb-tree__root">
        <span className="gb-tree__dot" style={{ background: color }} />
        <div className="gb-tree__root-body">
          <div className="gb-tree__root-name">{node.nickname}</div>
          <p className="gb-tree__root-text">{node.content}</p>
          {node.mood && root.showMood && (
            <span className="gb-tree__mood">{MOODS_FALLBACK[node.mood]}</span>
          )}
        </div>
        <button className="gb-tree__icon-btn" onClick={onClose} aria-label="收起" title="收起">
          <Icon name="x" size={13} />
        </button>
      </div>

      {/* 分支 */}
      <div className="gb-tree__branch">
        {(node.replies || []).length === 0 ? (
          <p className="gb-tree__empty">还没有回复</p>
        ) : (
          <NodeList nodes={node.replies} color={color} rootId={node.id} onReply={onReply} />
        )}
      </div>

      <button className="gb-tree__reply" onClick={() => onReply(node.id, node.id)}>
        <Icon name="reply" size={12} />
        回复这条
      </button>
    </div>
  );
}

/** 递归渲染一层节点 */
function NodeList({ nodes, color, rootId, onReply }) {
  return (
    <ul className="gb-node-list">
      {nodes.map((n) => (
        <li key={n.id} className="gb-node">
          <span className="gb-node__bullet" style={{ borderColor: color }} />
          <div className="gb-node__body">
            <div className="gb-node__head">
              <strong>{n.nickname}</strong>
              {n.is_admin ? <span className="chip chip--accent chip--mini">博主</span> : null}
              <button className="gb-node__reply" onClick={() => onReply(n.id, rootId)} title="回复这条">
                <Icon name="reply" size={11} />
              </button>
            </div>
            <p className="gb-node__text">{n.content}</p>
            {n.replies?.length > 0 && (
              <NodeList nodes={n.replies} color={color} rootId={rootId} onReply={onReply} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
