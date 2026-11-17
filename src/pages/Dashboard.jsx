import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { SLA_META } from "../SlaDashboardSection";
import {
  Avatar,
  Empty,
  Err,
  Icon,
  Loading,
  PageHeader,
  PriorityBadge,
  StatusBadge,
  TicketTable,
  STATUS_LABEL,
  STATUS_COLOR,
  PRIORITY_LABEL,
  fmt,
} from "../ui";

const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];
const PR_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function ymd(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function rangeOf(preset) {
  const end = new Date();
  const start = new Date();
  if (preset === "week") {
    const monday = (end.getDay() + 6) % 7;
    start.setDate(end.getDate() - monday);
  } else if (preset === "month") {
    start.setDate(1);
  }
  return { from: ymd(start), to: ymd(end) };
}

function ticketTime(d) {
  if (!d) return 0;
  const t = new Date(/Z$|[+-]\d\d:\d\d$/.test(d) ? d : d + "Z");
  return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}

function formatGreetingName(fullName) {
  const raw = (fullName || "").trim();
  if (!raw) return "bạn";
  const parts = raw.split(/\s+/);
  const last = parts[parts.length - 1];
  // Không cắt máy móc khiến "Staff A" thành "A"
  if (parts.length <= 2 || last.length <= 1) return raw;
  return raw;
}

function formatDurationMinutes(totalMinutes) {
  const abs = Math.abs(Math.round(totalMinutes || 0));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatRemainingText(item) {
  if (item.slaStatus === "COMPLETED") {
    return item.remainingMinutes >= 0
      ? `Sớm ${formatDurationMinutes(item.remainingMinutes)}`
      : `Trễ ${formatDurationMinutes(Math.abs(item.remainingMinutes))}`;
  }
  if (item.remainingMinutes < 0) {
    return `Quá hạn ${formatDurationMinutes(Math.abs(item.remainingMinutes))}`;
  }
  return `Còn ${formatDurationMinutes(item.remainingMinutes)}`;
}

function fillDays(from, to, series) {
  const map = new Map(
    (series || []).map((x) => [x.date || x.Date, x.count ?? x.Count ?? 0]),
  );
  if (!from || !to) return series || [];
  const out = [];
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end && out.length < 62) {
    const key = ymd(cur);
    out.push({ date: key, count: map.get(key) || 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out.length ? out : series || [];
}

function DayChart({ points }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  if (!points.length)
    return <p className="muted chart-empty">Chưa có dữ liệu.</p>;
  return (
    <div className="day-chart" role="img" aria-label="Số ticket theo ngày">
      {points.map((p) => (
        <div className="day-col" key={p.date}>
          <span>{p.count}</span>
          <div className="day-bar-track">
            <div style={{ height: `${(p.count / max) * 100}%` }} />
          </div>
          <small>{p.date.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

function SlaDistributionBars({ slaOverview }) {
  const slaCounts = slaOverview?.bySlaStatus || [];
  const maxSlaCount = Math.max(1, ...slaCounts.map((x) => x.count || 0));
  return (
    <div className="status-report">
      {["NORMAL", "WARNING", "OVERDUE", "COMPLETED"].map((key) => {
        const found = slaCounts.find((x) => x.slaStatus === key);
        const count = found?.count || 0;
        const meta = SLA_META[key];
        return (
          <div className="status-report-row sla-dist-row" key={key}>
            <span className="sla-dist-label">
              <i style={{ background: meta.color }} />
              <span>
                {meta.short} · <small>{meta.label}</small>
              </span>
            </span>
            <div className="progress-track">
              <div
                className={meta.barClass}
                style={{ width: `${(count / maxSlaCount) * 100}%` }}
              />
            </div>
            <strong>{count}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === "Admin";
  const isStaff = user.role === "Staff";
  const isUser = user.role === "User";
  const statsRole = isAdmin || isStaff;

  const initial = statsRole ? rangeOf("month") : { from: "", to: "" };
  const [preset, setPreset] = useState(statsRole ? "month" : "");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [refreshTick, setRefreshTick] = useState(0);

  const [stats, setStats] = useState(null);
  const [slaOverview, setSlaOverview] = useState(null);
  const [staffPerf, setStaffPerf] = useState([]);
  const [slaTickets, setSlaTickets] = useState([]);
  const [userTickets, setUserTickets] = useState([]);
  const [resolvedTickets, setResolvedTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busyTicketId, setBusyTicketId] = useState(null);

  // Reopen Modal state for User
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenNote, setReopenNote] = useState("");
  const [reopenErr, setReopenErr] = useState("");

  const applyRange = (nextFrom = from, nextTo = to) => {
    let start = nextFrom;
    let end = nextTo;
    if (start && end && start > end) [start, end] = [end, start];
    setFrom(start);
    setTo(end);
    setApplied({ from: start, to: end });
  };

  const loadDashboardData = useCallback(() => {
    let active = true;
    setLoading(true);
    setErr("");

    const p = new URLSearchParams();
    if (statsRole && applied.from) p.set("from", applied.from);
    if (statsRole && applied.to) p.set("to", applied.to);
    const qs = p.toString() ? `?${p.toString()}` : "";

    if (isUser) {
      Promise.all([
        api("/dashboard"),
        api("/tickets?page=1&pageSize=5"),
        api("/tickets?status=Resolved&page=1&pageSize=20"),
      ])
        .then(([dashRes, recentRes, resolvedRes]) => {
          if (!active) return;
          if (dashRes) setStats(dashRes);
          setUserTickets(recentRes?.items || []);
          setResolvedTickets(
            (resolvedRes?.items || []).filter(
              (t) => t.status === "Resolved" && t.createdById === user.userId,
            ),
          );
        })
        .catch((e) => {
          if (active) setErr(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      Promise.all([
        api(`/dashboard${qs}`),
        api(`/dashboard/sla-overview${qs}`),
        api(`/dashboard/staff-performance${qs}`),
        api("/dashboard/sla-tickets?page=1&pageSize=50&sort=overdue_desc"),
      ])
        .then(([dashRes, slaOvRes, staffPerfRes, slaTkRes]) => {
          if (!active) return;
          if (dashRes) setStats(dashRes);
          if (slaOvRes) setSlaOverview(slaOvRes);
          if (Array.isArray(staffPerfRes)) setStaffPerf(staffPerfRes);
          setSlaTickets(slaTkRes?.items || []);
        })
        .catch((e) => {
          if (active) setErr(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isUser, statsRole, applied.from, applied.to, user.userId, refreshTick]);

  useEffect(() => {
    const cleanup = loadDashboardData();
    return cleanup;
  }, [loadDashboardData]);

  // Thao tác của User: Xác nhận "Đã hết lỗi" (Resolved -> Closed)
  const handleConfirmClosed = async (ticket) => {
    if (busyTicketId) return;
    setActionErr("");
    setBusyTicketId(ticket.id);
    try {
      await api(`/tickets/${ticket.id}/status`, {
        method: "PATCH",
        body: {
          status: "Closed",
          note: "Người dùng xác nhận sự cố đã được khắc phục hoàn toàn.",
        },
      });
      setRefreshTick((n) => n + 1);
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setBusyTicketId(null);
    }
  };

  // Thao tác của User: Mở Modal "Vẫn còn lỗi" (Reopen: Resolved -> InProgress)
  const openReopenModal = (ticket) => {
    setReopenTarget(ticket);
    setReopenNote("");
    setReopenErr("");
  };

  const submitReopen = async (e) => {
    e.preventDefault();
    if (!reopenTarget || busyTicketId) return;
    const clean = reopenNote.trim();
    if (!clean) {
      setReopenErr("Vui lòng nhập mô tả lỗi vẫn còn gặp phải để nhân viên IT kiểm tra lại.");
      return;
    }
    setReopenErr("");
    setBusyTicketId(reopenTarget.id);
    try {
      await api(`/tickets/${reopenTarget.id}/status`, {
        method: "PATCH",
        body: { status: "InProgress", note: clean },
      });
      setReopenTarget(null);
      setReopenNote("");
      setRefreshTick((n) => n + 1);
    } catch (ex) {
      setReopenErr(ex.message);
    } finally {
      setBusyTicketId(null);
    }
  };

  const greet =
    new Date().getHours() < 12
      ? "Chào buổi sáng"
      : new Date().getHours() < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";

  const counts = stats?.byStatus || {};
  const openCount = counts.Open || 0;
  const inProgressCount = counts.InProgress || 0;
  const pendingCount = counts.Pending || 0;
  const resolvedCount = counts.Resolved || 0;
  const closedCount = counts.Closed || 0;
  const unassignedCount = stats?.unassigned || 0;
  const assignedOpenCount = Math.max(0, openCount - unassignedCount);
  const reopenedCount = stats?.reopened ?? slaOverview?.reopenedCount ?? 0;

  // Biểu đồ Donut trạng thái
  const chart = Object.entries(counts).filter(([, n]) => n > 0);
  const chartTotal = chart.reduce((sum, [, n]) => sum + n, 0);
  let angle = 0;
  const gradient = chart
    .map(([status, n]) => {
      const start = angle;
      angle += (n / chartTotal) * 360;
      return `${STATUS_COLOR[status] || "#a5afbf"} ${start}deg ${angle}deg`;
    })
    .join(", ");

  // Hàng đợi ưu tiên của Staff (chỉ lấy ticket đang hoạt động: Open, InProgress, Pending)
  const staffPriorityQueue = isStaff
    ? [...slaTickets]
        .filter((t) => ["Open", "InProgress", "Pending"].includes(t.status))
        .sort((a, b) => {
          const slaRank = (s) =>
            s === "OVERDUE" ? 0 : s === "WARNING" ? 1 : 2;
          return (
            slaRank(a.slaStatus) - slaRank(b.slaStatus) ||
            (PR_RANK[b.priority] || 0) - (PR_RANK[a.priority] || 0) ||
            ticketTime(a.createdAt) - ticketTime(b.createdAt)
          );
        })
        .slice(0, 6)
    : [];

  // 5 Ticket cần chú ý trên Admin Dashboard (ưu tiên: Chưa phân công -> OVERDUE -> WARNING -> Mới tạo)
  const adminAttentionTickets = isAdmin
    ? [...slaTickets]
        .sort((a, b) => {
          const aUnassigned = a.status === "Open" && !a.assignedToId ? 0 : 1;
          const bUnassigned = b.status === "Open" && !b.assignedToId ? 0 : 1;
          if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
          const slaRank = (s) =>
            s === "OVERDUE" ? 0 : s === "WARNING" ? 1 : s === "NORMAL" ? 2 : 3;
          if (slaRank(a.slaStatus) !== slaRank(b.slaStatus))
            return slaRank(a.slaStatus) - slaRank(b.slaStatus);
          return ticketTime(b.createdAt) - ticketTime(a.createdAt);
        })
        .slice(0, 5)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="TỔNG QUAN / DASHBOARD"
        title={`${greet}, ${formatGreetingName(user.fullName)} 👋`}
        description={
          isAdmin
            ? "Màn hình điều phối toàn hệ thống: theo dõi Ticket chưa phân công, cảnh báo SLA và hiệu suất nhân sự."
            : isStaff
              ? "Bàn làm việc cá nhân: ưu tiên xử lý các Ticket sắp quá hạn SLA và phản hồi người dùng."
              : "Theo dõi tiến độ các yêu cầu hỗ trợ của bạn và xác nhận kết quả khi bộ phận IT xử lý xong."
        }
        action={
          isStaff ? (
            <div className="detail-header-actions">
              <Link className="btn btn-secondary" to="/tickets?view=kanban">
                <Icon name="activity" />
                Mở Kanban
              </Link>
              <Link className="btn btn-primary" to="/sla">
                <Icon name="clock" />
                Chi tiết SLA
              </Link>
            </div>
          ) : (
            <Link className="btn btn-primary" to="/tickets/new">
              <Icon name="plus" />
              Tạo yêu cầu mới
            </Link>
          )
        }
      />

      {statsRole && (
        <div className="range-bar">
          <div className="range-presets">
            {[
              ["all", "Toàn bộ thời gian"],
              ["day", "Hôm nay"],
              ["week", "Tuần này"],
              ["month", "Tháng này"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`btn btn-small ${preset === key ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setPreset(key);
                  if (key === "all") {
                    applyRange("", "");
                  } else {
                    const r = rangeOf(key);
                    applyRange(r.from, r.to);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="range-inputs">
            <label className="range-date-field">
              <span>Từ</span>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset("");
                  setFrom(e.target.value);
                }}
              />
            </label>
            <span className="range-sep">→</span>
            <label className="range-date-field">
              <span>Đến</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset("");
                  setTo(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-small range-apply-btn"
              onClick={() => applyRange(from, to)}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {actionErr && <Err msg={actionErr} />}

      {err ? (
        <Err msg={err} />
      ) : loading && !stats ? (
        <Loading />
      ) : (
        <>
          {/* =====================================================
              1. USER DASHBOARD
             ===================================================== */}
          {isUser && (
            <div className="dashboard-stack">
              {/* Hàng 1: 4 KPI độc lập giữa Resolved và Closed */}
              <div className="metric-grid">
                {[
                  [
                    "Tổng yêu cầu của tôi",
                    stats?.total || 0,
                    "ticket",
                    "blue",
                    "Tất cả yêu cầu bạn đã gửi",
                  ],
                  [
                    "Đang xử lý",
                    openCount + inProgressCount + pendingCount,
                    "activity",
                    "purple",
                    `Mới tạo: ${openCount} · Đang làm: ${inProgressCount} · Chờ phản hồi: ${pendingCount}`,
                  ],
                  [
                    "Chờ bạn xác nhận",
                    resolvedCount,
                    "alert",
                    "orange",
                    resolvedCount > 0
                      ? "IT đã xử lý xong, chờ bạn nghiệm thu"
                      : "Không có yêu cầu chờ xác nhận",
                  ],
                  [
                    "Đã hoàn tất",
                    closedCount,
                    "check",
                    "green",
                    "Các yêu cầu đã xác nhận đóng",
                  ],
                ].map(([name, count, icon, tone, hint]) => (
                  <div className="metric-card" key={name}>
                    <div className="metric-top">
                      <span>{name}</span>
                      <span className={`metric-icon ${tone}`}>
                        <Icon name={icon} size={20} />
                      </span>
                    </div>
                    <div className="metric-value">{count}</div>
                    <p>{hint}</p>
                  </div>
                ))}
              </div>

              {/* Hàng 2: Khu vực CẦN BẠN XÁC NHẬN (chỉ hiển thị khi có ticket Status === "Resolved") */}
              {resolvedTickets.length > 0 && (
                <section className="panel user-verify-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">CẦN BẠN PHẢN HỒI NGHIỆM THU</div>
                      <h3>
                        Yêu cầu chờ bạn xác nhận kết quả (
                        {resolvedTickets.length})
                      </h3>
                      <p>
                        Nhân viên IT đã báo hoàn tất xử lý. Vui lòng kiểm tra
                        và chọn <strong>Đã hết lỗi</strong> để đóng ticket hoặc{" "}
                        <strong>Vẫn còn lỗi</strong> nếu sự cố chưa được khắc
                        phục.
                      </p>
                    </div>
                  </div>
                  <div className="user-verify-list">
                    {resolvedTickets.map((t) => (
                      <div className="user-verify-card" key={t.id}>
                        <div className="user-verify-info">
                          <div className="user-verify-top">
                            <Link
                              className="ticket-code"
                              to={`/tickets/${t.id}`}
                            >
                              {t.code}
                            </Link>
                            <PriorityBadge p={t.priority} />
                            <StatusBadge s={t.status} />
                          </div>
                          <Link
                            className="user-verify-title"
                            to={`/tickets/${t.id}`}
                          >
                            {t.title}
                          </Link>
                          <div className="user-verify-meta">
                            <span>
                              Phụ trách:{" "}
                              <strong>
                                {t.assignedTo || "Nhân viên IT"}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>
                              Giải quyết lúc:{" "}
                              <strong>{fmt(t.resolvedAt || t.createdAt)}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="user-verify-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            disabled={busyTicketId === t.id}
                            onClick={() => handleConfirmClosed(t)}
                          >
                            <Icon name="check" size={16} />
                            Đã hết lỗi
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small btn-reopen-warn"
                            disabled={busyTicketId === t.id}
                            onClick={() => openReopenModal(t)}
                          >
                            Vẫn còn lỗi
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Hàng 3: Donut Chart & Truy cập nhanh */}
              <div className="dashboard-grid">
                <section className="panel overview-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Phân bố trạng thái</h3>
                      <p>Tổng quan yêu cầu của bạn theo tiến độ</p>
                    </div>
                    <span className="panel-meta">
                      {stats?.total || 0} yêu cầu
                    </span>
                  </div>
                  <div className="chart-layout">
                    <div className="donut-wrap">
                      <div
                        className="status-donut"
                        style={{
                          background: chartTotal
                            ? `conic-gradient(${gradient})`
                            : "#e7ebf2",
                        }}
                        role="img"
                        aria-label={
                          chart
                            .map(([s, n]) => `${STATUS_LABEL[s] || s}: ${n}`)
                            .join(", ") || "Chưa có ticket"
                        }
                      />
                      <div className="donut-center">
                        <strong>{stats?.total || 0}</strong>
                        <span>Ticket</span>
                      </div>
                    </div>
                    <div className="legend">
                      {chart.length ? (
                        chart.map(([s, n]) => (
                          <div className="legend-row" key={s}>
                            <span>
                              <i style={{ background: STATUS_COLOR[s] }} />
                              {STATUS_LABEL[s] || s}
                            </span>
                            <strong>{n}</strong>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Chưa có dữ liệu thống kê.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Truy cập nhanh</h3>
                      <p>Các tác vụ thường sử dụng</p>
                    </div>
                  </div>
                  <div className="quick-actions">
                    {[
                      [
                        "/tickets/new",
                        "plus",
                        "Tạo yêu cầu hỗ trợ mới",
                        "Gửi mô tả sự cố đến bộ phận IT",
                      ],
                      [
                        "/tickets",
                        "ticket",
                        "Yêu cầu của tôi",
                        "Xem danh sách và tiến độ xử lý",
                      ],
                      [
                        "/tickets?status=Resolved",
                        "check",
                        "Yêu cầu cần phản hồi",
                        "Kiểm tra và xác nhận các ticket đã xử lý xong",
                      ],
                    ].map(([to, icon, name, desc]) => (
                      <Link className="quick-item" to={to} key={name}>
                        <span className="quick-icon">
                          <Icon name={icon} />
                        </span>
                        <span>
                          <strong>{name}</strong>
                          <small>{desc}</small>
                        </span>
                        <Icon name="arrow" size={18} />
                      </Link>
                    ))}
                  </div>
                  <div className="tip-strip">
                    <Icon name="help" />
                    <span>
                      {resolvedCount > 0
                        ? `Bạn có ${resolvedCount} yêu cầu đã được xử lý xong đang chờ bạn xác nhận kết quả.`
                        : "Cung cấp mã thiết bị, ảnh lỗi hoặc mô tả chi tiết giúp đội ngũ IT hỗ trợ nhanh hơn."}
                    </span>
                  </div>
                </section>
              </div>

              {/* Hàng 4: Yêu cầu gần đây của tôi (tối đa 5 ticket) */}
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Yêu cầu gần đây của tôi</h3>
                    <p>5 yêu cầu mới nhất bạn đã tạo</p>
                  </div>
                  <Link className="link-arrow" to="/tickets">
                    Xem tất cả <Icon name="arrow" size={16} />
                  </Link>
                </div>
                <TicketTable
                  items={userTickets.slice(0, 5)}
                  loading={loading}
                  user={user}
                  onClose={handleConfirmClosed}
                />
              </section>
            </div>
          )}

          {/* =====================================================
              2. STAFF DASHBOARD
             ===================================================== */}
          {isStaff && (
            <div className="dashboard-stack">
              {/* Hàng 1: 4 KPI tác nghiệp cá nhân */}
              <div className="metric-grid">
                {[
                  [
                    "Ticket được giao",
                    stats?.total || 0,
                    "ticket",
                    "blue",
                    "Trong khoảng thời gian đã chọn",
                  ],
                  [
                    "Cần xử lý ngay",
                    openCount + inProgressCount,
                    "activity",
                    "purple",
                    `Mới được giao (Open): ${openCount} · Đang làm: ${inProgressCount}`,
                  ],
                  [
                    "Chờ phản hồi / Nghiệm thu",
                    pendingCount + resolvedCount,
                    "clock",
                    "green",
                    `Chờ User phản hồi: ${pendingCount} · Chờ đóng: ${resolvedCount}`,
                  ],
                  [
                    "Cảnh báo SLA (24h)",
                    (slaOverview?.nearDeadline || 0) +
                      (slaOverview?.overdue || 0),
                    "alert",
                    (slaOverview?.overdue || 0) > 0 ? "red" : "orange",
                    `Quá hạn: ${slaOverview?.overdue || 0} · Sắp quá hạn (20h+): ${slaOverview?.nearDeadline || 0}`,
                  ],
                ].map(([name, count, icon, tone, hint]) => (
                  <div className="metric-card" key={name}>
                    <div className="metric-top">
                      <span>{name}</span>
                      <span className={`metric-icon ${tone}`}>
                        <Icon name={icon} size={20} />
                      </span>
                    </div>
                    <div className="metric-value">{count}</div>
                    <p>{hint}</p>
                  </div>
                ))}
              </div>

              {/* Hàng 2: SLA Summary & Hiệu suất cá nhân */}
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Tóm tắt SLA & Tiến độ của tôi</h3>
                      <p>Phân bố 4 mức SLA (Normal, Warning, Overdue, Completed)</p>
                    </div>
                    <Link className="link-arrow" to="/sla">
                      Xem chi tiết <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  <SlaDistributionBars slaOverview={slaOverview} />
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Hiệu suất xử lý cá nhân</h3>
                      <p>Chỉ số SLA trong khoảng thời gian đang lọc</p>
                    </div>
                    <Link className="link-arrow" to="/tickets?view=kanban">
                      Bảng Kanban <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  <div className="sla-exec-stats">
                    <div className="sla-exec-stat-item">
                      <span>Tỷ lệ đúng hạn SLA</span>
                      <strong className="text-blue">
                        {slaOverview?.slaComplianceRate ?? 0}%
                      </strong>
                      <small>Trên các ticket đã hoàn thành</small>
                    </div>
                    <div className="sla-exec-stat-item">
                      <span>Thời gian giải quyết TB</span>
                      <strong>
                        {slaOverview?.averageResolutionHours
                          ? `${slaOverview.averageResolutionHours} giờ`
                          : "0 giờ"}
                      </strong>
                      <small>Chu kỳ hiện tại</small>
                    </div>
                    <div className="sla-exec-stat-item">
                      <span>Quá hạn / Sắp quá hạn</span>
                      <strong className="text-red">
                        {slaOverview?.overdue ?? 0} /{" "}
                        {slaOverview?.nearDeadline ?? 0}
                      </strong>
                      <small>Overdue (≥24h) / Warning (≥20h)</small>
                    </div>
                    <div className="sla-exec-stat-item">
                      <span>Bị mở lại (Reopened)</span>
                      <strong>{reopenedCount}</strong>
                      <small>User phản hồi vẫn còn lỗi</small>
                    </div>
                  </div>
                </section>
              </div>

              {/* Hàng 3: Priority Action Queue (tối đa 6 ticket đang hoạt động) */}
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Hàng đợi ưu tiên cần xử lý (Priority Action Queue)</h3>
                    <p>
                      Các Ticket đang hoạt động (Open, InProgress, Pending) sắp
                      xếp theo mức khẩn cấp SLA và độ ưu tiên
                    </p>
                  </div>
                  <Link className="link-arrow" to="/tickets?view=list">
                    Xem toàn bộ ({slaOverview?.totalActive ?? 0}){" "}
                    <Icon name="arrow" size={16} />
                  </Link>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã Ticket</th>
                        <th>Tiêu đề</th>
                        <th>Ưu tiên</th>
                        <th>Trạng thái</th>
                        <th>Tiến độ SLA (24h)</th>
                        <th>Thời gian còn lại / Quá hạn</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPriorityQueue.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <Empty
                              title="Không có ticket đang tồn đọng"
                              description="Tất cả ticket được giao cho bạn đều đã được giải quyết."
                            />
                          </td>
                        </tr>
                      ) : (
                        staffPriorityQueue.map((t) => {
                          const meta =
                            SLA_META[t.slaStatus] || SLA_META.NORMAL;
                          return (
                            <tr
                              key={t.id}
                              className={
                                t.slaStatus === "OVERDUE"
                                  ? "sla-row-overdue"
                                  : t.slaStatus === "WARNING"
                                    ? "sla-row-warning"
                                    : undefined
                              }
                            >
                              <td className="nowrap">
                                <Link
                                  className="ticket-code"
                                  to={`/tickets/${t.id}`}
                                >
                                  {t.code}
                                </Link>
                                {t.isReopened && (
                                  <span className="sla-reopen-tag">
                                    Reopened
                                  </span>
                                )}
                              </td>
                              <td>
                                <Link
                                  className="table-title"
                                  to={`/tickets/${t.id}`}
                                >
                                  {t.title}
                                </Link>
                                <span className="subtle">{t.category}</span>
                              </td>
                              <td>
                                <PriorityBadge p={t.priority} />
                              </td>
                              <td>
                                <StatusBadge s={t.status} />
                              </td>
                              <td style={{ minWidth: 165 }}>
                                <div className="sla-progress-cell">
                                  <div className="sla-progress-top">
                                    <span>
                                      Đã qua:{" "}
                                      {formatDurationMinutes(t.elapsedMinutes)}
                                    </span>
                                    <span
                                      className={`badge sla-badge ${meta.badgeClass}`}
                                    >
                                      {meta.short}
                                    </span>
                                  </div>
                                  <div className="sla-progress-track">
                                    <div
                                      className={`sla-progress-fill ${meta.barClass}`}
                                      style={{ width: `${t.progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="nowrap">
                                <span
                                  className={`sla-rem-text sla-rem-${t.slaStatus.toLowerCase()}`}
                                >
                                  {formatRemainingText(t)}
                                </span>
                              </td>
                              <td className="nowrap">
                                <Link
                                  className="btn btn-primary btn-small"
                                  to={`/tickets/${t.id}`}
                                >
                                  Xử lý
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* =====================================================
              3. ADMIN DASHBOARD
             ===================================================== */}
          {isAdmin && (
            <div className="dashboard-stack">
              {/* Hàng 1: 5 KPI điều phối (không đếm trùng) */}
              <div className="sla-metric-grid">
                {[
                  [
                    "Tổng Ticket",
                    stats?.total || 0,
                    "ticket",
                    "blue",
                    `Đã đóng: ${closedCount} · Đã hủy: ${counts.Cancelled || 0}`,
                  ],
                  [
                    "Chưa phân công",
                    unassignedCount,
                    "users",
                    unassignedCount > 0 ? "orange" : "blue",
                    "Ticket Open chưa có Staff phụ trách",
                  ],
                  [
                    "Đang xử lý",
                    assignedOpenCount + inProgressCount + pendingCount,
                    "activity",
                    "purple",
                    `Đã giao: ${assignedOpenCount} · Đang làm: ${inProgressCount} · Pending: ${pendingCount}`,
                  ],
                  [
                    "Chờ User xác nhận",
                    resolvedCount,
                    "check",
                    "green",
                    `Đã giải quyết · Bị mở lại (Reopen): ${reopenedCount}`,
                  ],
                  [
                    "Quá hạn SLA (24h)",
                    slaOverview?.overdue || 0,
                    "alert",
                    (slaOverview?.overdue || 0) > 0 ? "red" : "blue",
                    `Sắp quá hạn (Warning 20h+): ${slaOverview?.nearDeadline || 0}`,
                  ],
                ].map(([name, count, icon, tone, hint]) => (
                  <div
                    className={`metric-card sla-card-${tone}`}
                    key={name}
                  >
                    <div className="metric-top">
                      <span>{name}</span>
                      <span className={`metric-icon ${tone}`}>
                        <Icon name={icon} size={19} />
                      </span>
                    </div>
                    <div className="metric-value">{count}</div>
                    <p>{hint}</p>
                  </div>
                ))}
              </div>

              {/* Hàng 2: SLA Executive Summary & Operational Alerts (2 cột) */}
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Tổng quan SLA (SLA Executive Summary)</h3>
                      <p>
                        Đúng hạn SLA:{" "}
                        <strong>
                          {slaOverview?.slaComplianceRate ?? 0}%
                        </strong>{" "}
                        · TG giải quyết TB:{" "}
                        <strong>
                          {slaOverview?.averageResolutionHours ?? 0} giờ
                        </strong>
                      </p>
                    </div>
                    <Link className="link-arrow" to="/sla">
                      Xem chi tiết <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  <SlaDistributionBars slaOverview={slaOverview} />
                </section>

                <section className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Cảnh báo vận hành (Operational Alerts)</h3>
                      <p>Các điểm nghẽn cần Admin điều phối</p>
                    </div>
                  </div>
                  <div className="ops-alert-list">
                    <Link
                      className={`ops-alert-item ${unassignedCount > 0 ? "is-warn" : ""}`}
                      to="/tickets?view=list&status=Open"
                    >
                      <span className="ops-alert-icon orange">
                        <Icon name="users" size={18} />
                      </span>
                      <div className="ops-alert-body">
                        <strong>
                          {unassignedCount} Ticket chưa được phân công
                        </strong>
                        <small>
                          {unassignedCount > 0
                            ? "Cần phân công nhân viên IT tiếp nhận xử lý."
                            : "Tất cả ticket mới đều đã có người phụ trách."}
                        </small>
                      </div>
                      <Icon name="arrow" size={16} />
                    </Link>

                    <Link
                      className={`ops-alert-item ${(slaOverview?.overdue || 0) > 0 ? "is-danger" : ""}`}
                      to="/sla"
                    >
                      <span className="ops-alert-icon red">
                        <Icon name="alert" size={18} />
                      </span>
                      <div className="ops-alert-body">
                        <strong>
                          {slaOverview?.overdue || 0} Ticket đã quá hạn SLA 24h
                        </strong>
                        <small>
                          {(slaOverview?.nearDeadline || 0) > 0
                            ? `Có thêm ${slaOverview.nearDeadline} ticket đang ở mức Warning (20h–24h).`
                            : "Kiểm tra tiến độ và hỗ trợ nhân viên xử lý."}
                        </small>
                      </div>
                      <Icon name="arrow" size={16} />
                    </Link>

                    <Link className="ops-alert-item" to="/sla">
                      <span className="ops-alert-icon purple">
                        <Icon name="activity" size={18} />
                      </span>
                      <div className="ops-alert-body">
                        <strong>
                          {reopenedCount} Ticket bị mở lại (Reopened)
                        </strong>
                        <small>
                          {reopenedCount > 0
                            ? "Người dùng phản hồi sự cố vẫn còn lỗi sau khi Resolved."
                            : "Chưa có ticket nào bị mở lại trong kỳ."}
                        </small>
                      </div>
                      <Icon name="arrow" size={16} />
                    </Link>
                  </div>
                </section>
              </div>

              {/* Hàng 3: Biểu đồ Ticket theo ngày & Phân bố theo danh mục (2 cột) */}
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Ticket theo ngày</h3>
                      <p>Số yêu cầu tạo mới trong khoảng thời gian đã chọn</p>
                    </div>
                  </div>
                  <DayChart
                    points={fillDays(applied.from, applied.to, stats?.series)}
                  />
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Phân bố theo danh mục & Mức ưu tiên</h3>
                      <p>
                        Điểm đánh giá TB:{" "}
                        {stats?.averageRating
                          ? `${Number(stats.averageRating).toFixed(1)} / 5 ★`
                          : "Chưa có đánh giá"}
                      </p>
                    </div>
                  </div>
                  <div className="status-report">
                    {stats?.byCategory?.length ? (
                      stats.byCategory.map((x) => {
                        const catName = x.category || x.Category;
                        const catCount = x.count ?? x.Count ?? 0;
                        return (
                          <div className="status-report-row" key={catName}>
                            <span>{catName}</span>
                            <div className="progress-track">
                              <div
                                style={{
                                  width: `${
                                    stats.total
                                      ? (catCount / stats.total) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <strong>{catCount}</strong>
                          </div>
                        );
                      })
                    ) : (
                      <p className="muted">Chưa có dữ liệu danh mục.</p>
                    )}
                  </div>
                </section>
              </div>

              {/* Hàng 4: Bảng Hiệu suất & Tải công việc của Support Staff (Hợp nhất duy nhất 1 bảng) */}
              <section className="panel sla-staff-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Hiệu suất & Tải công việc Support Staff</h3>
                    <p>
                      Theo dõi số lượng Ticket đang phụ trách, tình trạng SLA,
                      số lần Reopen và tỷ lệ hoàn thành đúng hạn
                    </p>
                  </div>
                  <Link className="link-arrow" to="/sla">
                    Phân tích SLA chi tiết <Icon name="arrow" size={15} />
                  </Link>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Đang xử lý (Active)</th>
                        <th>Trong hạn (Normal)</th>
                        <th>Warning (20h+)</th>
                        <th>Overdue (≥24h)</th>
                        <th>Reopened</th>
                        <th>Completed</th>
                        <th>TG xử lý TB</th>
                        <th>SLA Compliance</th>
                        <th>Tình trạng tải</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPerf.map((s) => {
                        const hasOverdue = s.overdueCount > 0;
                        const hasWarning = s.warningCount > 0;
                        return (
                          <tr key={s.staffId}>
                            <td>
                              <div className="sla-staff-cell">
                                <Avatar name={s.staffName} />
                                <div>
                                  <strong>{s.staffName}</strong>
                                  <small className="subtle">{s.email}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{s.activeCount}</strong>
                            </td>
                            <td>{s.onTrackCount}</td>
                            <td>
                              <span
                                className={
                                  hasWarning ? "sla-num-warning" : "muted"
                                }
                              >
                                {s.warningCount}
                              </span>
                            </td>
                            <td>
                              <span
                                className={
                                  hasOverdue ? "sla-num-overdue" : "muted"
                                }
                              >
                                {s.overdueCount}
                              </span>
                            </td>
                            <td>{s.reopenedCount ?? 0}</td>
                            <td>{s.completedCount}</td>
                            <td>
                              <strong>
                                {s.averageResolutionHours > 0
                                  ? `${s.averageResolutionHours}h`
                                  : "—"}
                              </strong>
                            </td>
                            <td>
                              <strong>{s.slaComplianceRate ?? 0}%</strong>
                            </td>
                            <td className="nowrap">
                              {hasOverdue ? (
                                <span className="badge sla-badge sla-badge-overdue">
                                  Có {s.overdueCount} ticket quá hạn
                                </span>
                              ) : hasWarning ? (
                                <span className="badge sla-badge sla-badge-warning">
                                  Có {s.warningCount} sắp quá hạn
                                </span>
                              ) : s.activeCount > 0 ? (
                                <span className="badge sla-badge sla-badge-normal">
                                  Đang xử lý ổn định
                                </span>
                              ) : (
                                <span className="badge">Sẵn sàng nhận việc</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {staffPerf.length === 0 && (
                        <tr>
                          <td colSpan={10}>
                            <p className="muted" style={{ padding: 12 }}>
                              Chưa có dữ liệu nhân viên hỗ trợ.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Hàng 5: 5 Ticket cần chú ý gần nhất */}
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Ticket cần chú ý</h3>
                    <p>
                      Ưu tiên hiển thị các Ticket chưa phân công, quá hạn SLA
                      hoặc mới được tạo
                    </p>
                  </div>
                  <Link className="link-arrow" to="/tickets?view=list">
                    Xem tất cả <Icon name="arrow" size={16} />
                  </Link>
                </div>
                <TicketTable
                  items={adminAttentionTickets}
                  loading={loading}
                  user={user}
                />
              </section>
            </div>
          )}
        </>
      )}

      {/* Modal nhập lý do mở lại Ticket (Reopen: Resolved -> InProgress) dành cho User */}
      {reopenTarget && (
        <div
          className="kanban-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Phản hồi yêu cầu vẫn còn lỗi"
        >
          <div className="panel kanban-modal">
            <div className="kanban-modal-header">
              <div>
                <div className="eyebrow">YÊU CẦU XỬ LÝ LẠI / REOPEN</div>
                <h3>Báo vẫn còn lỗi: {reopenTarget.code}</h3>
              </div>
              <button
                type="button"
                className="top-icon"
                aria-label="Đóng"
                onClick={() => setReopenTarget(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="kanban-modal-desc">
              Ticket <strong>{reopenTarget.title}</strong> sẽ được chuyển về
              trạng thái <strong>Đang xử lý (InProgress)</strong> để nhân viên
              IT tiếp tục khắc phục.
            </p>
            <Err msg={reopenErr} />
            <form onSubmit={submitReopen}>
              <label className="form-label">
                Mô tả chi tiết tình trạng lỗi vẫn gặp phải *
                <textarea
                  rows="4"
                  placeholder="Ví dụ: Máy in vẫn báo kẹt giấy ở khay số 2 sau khi in thử…"
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <div className="progress-note-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyTicketId === reopenTarget.id}
                  onClick={() => setReopenTarget(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busyTicketId === reopenTarget.id}
                >
                  {busyTicketId === reopenTarget.id
                    ? "Đang gửi…"
                    : "Gửi phản hồi & Mở lại"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
