import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import { Avatar, Icon, ROLE_LABEL, fmt } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import NewTicket from "./pages/NewTicket";
import TicketDetail from "./pages/TicketDetail";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import SlaMonitoring from "./pages/SlaMonitoring";

function NotificationBell() {
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unreadCount: 0, items: [] });
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(() => {
    api("/notifications?take=30")
      .then((res) => {
        if (res && Array.isArray(res.items)) setData(res);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  useEffect(() => {
    const timer = setInterval(load, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const handleSelect = async (n) => {
    if (!n.isRead) {
      setData((prev) => ({
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((x) =>
          x.id === n.id ? { ...x, isRead: true } : x,
        ),
      }));
      api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(
        () => {},
      );
    }
    setOpen(false);
    if (n.ticketId) nav(`/tickets/${n.ticketId}`);
  };

  const handleReadAll = async () => {
    if (!data.unreadCount || busy) return;
    setBusy(true);
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setData((prev) => ({
        unreadCount: 0,
        items: prev.items.map((x) => ({ ...x, isRead: true })),
      }));
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notification-wrap" ref={wrapRef}>
      <button
        type="button"
        className="top-icon notification-btn"
        title="Thông báo"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <Icon name="bell" />
        {data.unreadCount > 0 && (
          <>
            <span className="notification-dot" />
            <span className="notification-badge">
              {data.unreadCount > 99 ? "99+" : data.unreadCount}
            </span>
          </>
        )}
      </button>
      {open && (
        <div
          className="notification-dropdown"
          role="dialog"
          aria-label="Danh sách thông báo"
        >
          <div className="notification-head">
            <div>
              <strong>Thông báo</strong>
              {data.unreadCount > 0 && (
                <span className="notification-unread-pill">
                  {data.unreadCount} chưa đọc
                </span>
              )}
            </div>
            {data.unreadCount > 0 && (
              <button
                type="button"
                className="notification-read-all"
                disabled={busy}
                onClick={handleReadAll}
              >
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          <div className="notification-list">
            {data.items.length === 0 ? (
              <div className="notification-empty">
                <Icon name="bell" size={24} />
                <span>Chưa có thông báo nào.</span>
              </div>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-item ${n.isRead ? "" : "is-unread"}`}
                  onClick={() => handleSelect(n)}
                >
                  <div className="notification-item-top">
                    <strong>{n.title}</strong>
                    {!n.isRead && <span className="notification-item-dot" />}
                  </div>
                  <p className="notification-item-msg">{n.message}</p>
                  <span className="notification-item-time">
                    {fmt(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildNavGroups(role, resolvedCount) {
  if (role === "Admin") {
    return [
      {
        label: "ĐIỀU PHỐI & GIÁM SÁT",
        items: [
          {
            key: "overview",
            to: "/",
            icon: "dashboard",
            text: "Tổng quan",
            isActive: (path) => path === "/",
          },
          {
            key: "tickets-list",
            to: "/tickets?view=list",
            icon: "ticket",
            text: "Quản lý Ticket",
            isActive: (path, sp) =>
              path === "/tickets" && sp.get("view") !== "kanban",
          },
          {
            key: "tickets-kanban",
            to: "/tickets?view=kanban",
            icon: "activity",
            text: "Bảng Kanban",
            isActive: (path, sp) =>
              path === "/tickets" && sp.get("view") === "kanban",
          },
          {
            key: "sla",
            to: "/sla",
            icon: "clock",
            text: "Giám sát SLA & Hiệu suất",
            isActive: (path) => path === "/sla",
          },
          {
            key: "new-ticket",
            to: "/tickets/new",
            icon: "plus",
            text: "Tạo yêu cầu",
            isActive: (path) => path === "/tickets/new",
          },
        ],
      },
      {
        label: "QUẢN TRỊ HỆ THỐNG",
        items: [
          {
            key: "admin-users",
            to: "/admin",
            icon: "users",
            text: "Quản lý người dùng",
            isActive: (path) => path === "/admin",
          },
          {
            key: "admin-categories",
            to: "/admin/categories",
            icon: "folder",
            text: "Danh mục sự cố",
            isActive: (path) => path === "/admin/categories",
          },
          {
            key: "profile",
            to: "/profile",
            icon: "user",
            text: "Hồ sơ cá nhân",
            isActive: (path) => path === "/profile",
          },
        ],
      },
    ];
  }

  if (role === "Staff") {
    return [
      {
        label: "KHÔNG GIAN LÀM VIỆC",
        items: [
          {
            key: "overview",
            to: "/",
            icon: "dashboard",
            text: "Tổng quan",
            isActive: (path) => path === "/",
          },
          {
            key: "tickets-list",
            to: "/tickets?view=list",
            icon: "ticket",
            text: "Ticket được giao",
            isActive: (path, sp) =>
              path === "/tickets" && sp.get("view") !== "kanban",
          },
          {
            key: "tickets-kanban",
            to: "/tickets?view=kanban",
            icon: "activity",
            text: "Bảng Kanban",
            isActive: (path, sp) =>
              path === "/tickets" && sp.get("view") === "kanban",
          },
          {
            key: "sla",
            to: "/sla",
            icon: "clock",
            text: "Giám sát SLA",
            isActive: (path) => path === "/sla",
          },
          {
            key: "profile",
            to: "/profile",
            icon: "user",
            text: "Hồ sơ cá nhân",
            isActive: (path) => path === "/profile",
          },
        ],
      },
    ];
  }

  // USER
  return [
    {
      label: "KHÔNG GIAN LÀM VIỆC",
      items: [
        {
          key: "overview",
          to: "/",
          icon: "dashboard",
          text: "Tổng quan",
          isActive: (path) => path === "/",
        },
        {
          key: "my-tickets",
          to: "/tickets",
          icon: "ticket",
          text: "Yêu cầu của tôi",
          isActive: (path, sp) =>
            path === "/tickets" && sp.get("status") !== "Resolved",
        },
        {
          key: "new-ticket",
          to: "/tickets/new",
          icon: "plus",
          text: "Tạo yêu cầu mới",
          isActive: (path) => path === "/tickets/new",
        },
        {
          key: "need-feedback",
          to: "/tickets?status=Resolved",
          icon: "check",
          text: "Cần phản hồi",
          badge: resolvedCount > 0 ? resolvedCount : 0,
          isActive: (path, sp) =>
            path === "/tickets" && sp.get("status") === "Resolved",
        },
        {
          key: "profile",
          to: "/profile",
          icon: "user",
          text: "Hồ sơ cá nhân",
          isActive: (path) => path === "/profile",
        },
      ],
    },
  ];
}

function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user?.role !== "User") {
      setResolvedCount(0);
      return;
    }
    let active = true;
    api("/tickets?status=Resolved&page=1&pageSize=1")
      .then((res) => {
        if (active && typeof res?.total === "number") {
          setResolvedCount(res.total);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.role, location.pathname, location.search]);

  const searchParams = new URLSearchParams(location.search);
  const groups = buildNavGroups(user.role, resolvedCount);
  const allItems = groups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) =>
    item.isActive(location.pathname, searchParams),
  );

  const current =
    location.pathname.startsWith("/tickets/") &&
    location.pathname !== "/tickets/new"
      ? "Chi tiết ticket"
      : activeItem?.text || "Không gian làm việc";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`} id="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="headset" size={23} />
          </span>
          <div>
            <strong>
              HelpDesk<span className="brand-dot">.</span>
            </strong>
            <small>SUPPORT PLATFORM</small>
          </div>
          <button
            className="mobile-close"
            aria-label="Đóng menu"
            onClick={() => setMobile(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="side-nav-groups" aria-label="Điều hướng chính">
          {groups.map((group) => (
            <div className="side-nav-group" key={group.label}>
              <div className="sidebar-label">{group.label}</div>
              <div className="side-nav">
                {group.items.map((l) => {
                  const active = l.isActive(location.pathname, searchParams);
                  return (
                    <Link
                      key={l.key}
                      to={l.to}
                      onClick={() => setMobile(false)}
                      className={`nav-link ${active ? "active" : ""}`}
                    >
                      <Icon name={l.icon} />
                      <span className="nav-link-text">{l.text}</span>
                      {l.badge > 0 && (
                        <span className="nav-badge">
                          {l.badge > 99 ? "99+" : l.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Icon name="help" />
            </span>
            <strong>Cần hỗ trợ?</strong>
            <p>Quản lý và theo dõi mọi yêu cầu kỹ thuật tại một nơi.</p>
          </div>
          <div className="sidebar-version">
            IT HELPDESK <span>v1.0</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Đóng menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <button
            className="hamburger"
            aria-label="Mở menu"
            aria-expanded={mobile}
            aria-controls="sidebar"
            onClick={() => setMobile(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            Hệ thống <span>/</span> {current}
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <Link className="user-button" to="/profile">
              <Avatar name={user.fullName} />
              <span>
                <strong>{user.fullName}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </Link>
            <button
              className="top-icon"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children || <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="tickets" element={<Tickets />} />
          <Route
            path="tickets/new"
            element={
              <Protected roles={["User", "Admin"]}>
                <NewTicket />
              </Protected>
            }
          />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route
            path="sla"
            element={
              <Protected roles={["Admin", "Staff"]}>
                <SlaMonitoring />
              </Protected>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route
            path="admin"
            element={
              <Protected roles={["Admin"]}>
                <Admin section="users" />
              </Protected>
            }
          />
          <Route
            path="admin/categories"
            element={
              <Protected roles={["Admin"]}>
                <Admin section="categories" />
              </Protected>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
