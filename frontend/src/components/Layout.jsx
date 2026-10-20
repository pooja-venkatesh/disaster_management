import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { fetchNotifications, markAllRead, markOneRead } from '../api/axios';
import '../styles/layout.css';

const ShieldSVG = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L20 6V12C20 16.4 16.7 20.5 12 22C7.3 20.5 4 16.4 4 12V6L12 2Z"/>
  </svg>
);
const BellSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const NAV_LINKS = {
  victim: [
    { to: '/victim/dashboard',   label: 'Dashboard' },
    { to: '/victim/request/new', label: 'New Request' },
    { to: '/victim/shelters',    label: 'Shelter Map' },
    { to: '/victim/requests',    label: 'My Requests' },
  ],
  shelter: [
    { to: '/shelter/dashboard', label: 'Dashboard' },
    { to: '/shelter/requests',  label: 'Requests' },
    { to: '/shelter/inventory', label: 'Inventory' },
    { to: '/shelter/history',   label: 'History' },
    { to: '/shelter/setup',     label: 'Profile' },
  ],
  admin: [
    { to: '/admin/dashboard',  label: 'Dashboard' },
    { to: '/admin/shelters',   label: 'Shelters' },
    { to: '/admin/map',        label: 'Map' },
    { to: '/admin/requests',   label: 'Requests' },
    { to: '/admin/unresolved', label: 'Unresolved' },
    { to: '/admin/analytics',  label: 'Analytics' },
  ],
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── Notification Bell ────────────────────────────────────────────────
const NotificationBell = () => {
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const { socket }          = useSocket();

  const load = async () => {
    try {
      const res = await fetchNotifications();
      setNotifs(res.data.data.notifications);
      setUnread(res.data.data.unreadCount);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Live socket: push new notifications without polling
  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      setNotifs((prev) => [notif, ...prev].slice(0, 30));
      setUnread((c) => c + 1);
    };
    socket.on('notification:new', handler);
    return () => socket.off('notification:new', handler);
  }, [socket]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleClickNotif = async (n) => {
    if (!n.is_read) {
      await markOneRead(n.notification_id);
      setNotifs((prev) => prev.map((x) => x.notification_id === n.notification_id ? { ...x, is_read: true } : x));
      setUnread((c) => Math.max(0, c - 1));
    }
  };

  return (
    <div className="notif-wrapper" ref={ref}>
      <button className="notif-btn" onClick={() => setOpen(!open)} aria-label="Notifications">
        <BellSVG />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h3>Notifications</h3>
            {unread > 0 && <button className="notif-mark-all-btn" onClick={handleMarkAll}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0
              ? <p className="notif-empty">No notifications yet.</p>
              : notifs.map((n) => (
                <div
                  key={n.notification_id}
                  className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                  onClick={() => handleClickNotif(n)}
                >
                  <span className={`notif-dot ${n.is_read ? 'read' : n.type}`} />
                  <div className="notif-content">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────
const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };
  const links = NAV_LINKS[user?.role] || [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to={`/${user?.role}/dashboard`} className="topbar-brand">
          <div className="topbar-logo"><ShieldSVG /></div>
          <span className="topbar-title">DisasterRM</span>
        </NavLink>

        <nav className="topbar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          <NotificationBell />
          <div className="topbar-user">
            <div className={`topbar-avatar avatar--${user?.role}`}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="topbar-user-name">{user?.name}</span>
          </div>
          <button className="btn-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="page-wrapper">
        {children}
      </div>
    </div>
  );
};

export default Layout;
