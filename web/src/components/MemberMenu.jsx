import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMember } from '../context/MemberContext';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { CAN_TRANSITION } from '../lib/viewTransition';

/** 右上角访客账号入口：未登录显示「登录」，已登录显示头像菜单 */
export default function MemberMenu() {
  const { member, status, isAdmin, logout } = useMember();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (status === 'booting') return null;

  if (status !== 'authed') {
    return (
      <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="btn btn--ghost member-login" to="/login">
        <Icon name="user" size={16} />
        登录
      </Link>
    );
  }

  const name = member?.display_name || member?.username || '用户';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="member-menu" ref={ref}>
      <button
        className="member-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="账号菜单"
      >
        <span className="member-menu__avatar">
          {member?.avatar ? <img src={member.avatar} alt="" /> : initial}
        </span>
      </button>

      {open && (
        <div className="member-menu__panel">
          <div className="member-menu__head">
            <span className="member-menu__avatar member-menu__avatar--lg">
              {member?.avatar ? <img src={member.avatar} alt="" /> : initial}
            </span>
            <div>
              <strong>{name}</strong>
              <span className="faint">
                {isAdmin ? '管理员' : `@${member?.username}`}
              </span>
            </div>
          </div>
          <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="member-menu__item" to="/profile" onClick={() => setOpen(false)}>
            <Icon name="user" size={15} />个人中心
          </Link>
          {isAdmin && (
            <a className="member-menu__item" href="/admin/" onClick={() => setOpen(false)}>
              <Icon name="settings" size={15} />进入后台
            </a>
          )}
          <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="member-menu__item" to="/chat?room=members" onClick={() => setOpen(false)}>
            <Icon name="message" size={15} />用户聊天室
          </Link>
          <Link {...(CAN_TRANSITION ? { viewTransition: true } : {})} className="member-menu__item" to="/guestbook" onClick={() => setOpen(false)}>
            <Icon name="message-square" size={15} />留言墙
          </Link>
          <button
            className="member-menu__item member-menu__item--danger"
            onClick={async () => {
              // 管理员会话存在 pblog.admin.refresh，需一并清理
              const adminRt = localStorage.getItem('pblog.admin.refresh');
              if (adminRt) {
                try { await api.post('/auth/logout', { refreshToken: adminRt }, { auth: false }); } catch (_) {}
                localStorage.removeItem('pblog.admin.refresh');
                sessionStorage.removeItem('pblog.admin.access');
              }
              await logout();
              setOpen(false);
              navigate('/');
            }}
          >
            <Icon name="logout" size={15} />退出登录
          </button>
        </div>
      )}
    </div>
  );
}
