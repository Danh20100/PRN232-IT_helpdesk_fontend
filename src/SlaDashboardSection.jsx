import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";
import {
  Avatar,
  Empty,
  Err,
  Icon,
  PRIORITY_LABEL,
  PriorityBadge,
  STATUS_LABEL,
  StatusBadge,
  fmt,
} from "./ui";

const SLA_META = {
  NORMAL: {
    label: "Trong hạn (On Track)",
    short: "NORMAL",
    color: "#3f67db",
    bg: "#eaf0ff",
    barClass: "sla-bar-normal",
    badgeClass: "sla-badge-normal",
  },
  WARNING: {
    label: "Sắp quá hạn (Warning)",
    short: "WARNING",
    color: "#e6931f",
    bg: "#fff4e2",
    barClass: "sla-bar-warning",
    badgeClass: "sla-bar-warning",
    badgeCls: "sla-badge-warning",
  },
  OVERDUE: {
    label: "Quá hạn (Overdue)",
    short: "OVERDUE",
    color: "#df4c4c",
    bg: "#fdeaea",
    barClass: "sla-bar-overdue",
    badgeClass: "sla-badge-overdue",
  },
  COMPLETED: {
    label: "Đã hoàn thành",
    short: "COMPLETED",
    color: "#25b58c",
    bg: "#e6f8f2",
    barClass: "sla-bar-completed",
    badgeClass: "sla-badge-completed",
  },
};

function formatDurationMinutes(totalMinutes) {
  const abs = Math.abs(Math.round(totalMinutes || 0));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatRemaining(item) {
  if (item.slaStatus === "COMPLETED") {
    return item.remainingMinutes >= 0
      ? `Hoàn thành sớm ${formatDurationMinutes(item.remainingMinutes)}`
      : `Hoàn thành trễ ${formatDurationMinutes(Math.abs(item.remainingMinutes))}`;
  }
  if (item.remainingMinutes < 0) {
    return `Quá hạn ${formatDurationMinutes(Math.abs(item.remainingMinutes))}`;
  }
  return `Còn ${formatDurationMinutes(item.remainingMinutes)}`;
}

function SlaBadge({ status }) {
  const m = SLA_META[status] || SLA_META.NORMAL;
  const cls = m.badgeCls || m.badgeClass;
  return (
    <span className={`badge sla-badge ${cls}`} title={m.label}>
      {m.short} · {m.label}
    </span>
  );
}

export default function SlaDashboardSection({ user, from, to }) {
  const isAdmin = user?.role === "Admin";
  const [overview, setOverview] = useState(null);
  const [staffPerf, setStaffPerf] = useState([]);
  const [ticketsData, setTicketsData] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    items: [],
  });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [err, setErr] = useState("");

  // Filters for SLA Ticket Monitoring Table
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState("");
  const [slaStatus, setSlaStatus] = useState("");
  const [sort, setSort] = useState("overdue_desc");
  const [page, setPage] = useState(1);

  const loadOverviewAndPerf = useCallback(() => {
    setLoadingOverview(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString() ? `?${p}` : "";

    Promise.all([
      api(`/dashboard/sla-overview${qs}`),
      api("/dashboard/staff-performance"),
    ])
      .then(([ov, sp]) => {
        if (ov) setOverview(ov);
        if (Array.isArray(sp)) setStaffPerf(sp);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoadingOverview(false));
  }, [from, to]);

  const loadTickets = useCallback(() => {
    setLoadingTickets(true);
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (priority) p.set("priority", priority);
    if (status) p.set("status", status);
    if (isAdmin && staffId) p.set("staffId", staffId);
    if (slaStatus) p.set("slaStatus", slaStatus);
    if (sort) p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", "10");

    api(`/dashboard/sla-tickets?${p.toString()}`)
      .then((res) => {
        if (res && Array.isArray(res.items)) setTicketsData(res);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoadingTickets(false));
  }, [search, priority, status, isAdmin, staffId, slaStatus, sort, page]);

  useEffect(() => {
    loadOverviewAndPerf();
  }, [loadOverviewAndPerf]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const cards = [
    {
      title: "Total Active Tickets",
      sub: "Đang xử lý trong SLA",
      value: overview?.totalActive ?? 0,
      icon: "activity",
      tone: "blue",
    },
    {
      title: "Tickets On Track",
      sub: "NORMAL (< 20 giờ)",
      value: overview?.onTrack ?? 0,
      icon: "clock",
      tone: "blue",
    },
    {
      title: "Tickets Near Deadline",
      sub: "WARNING (20h – < 24h)",
      value: overview?.nearDeadline ?? 0,
      icon: "alert",
      tone: "orange",
    },
    {
      title: "Overdue Tickets",
      sub: "OVERDUE (≥ 24 giờ)",
      value: overview?.overdue ?? 0,
      icon: "alert",
      tone: "red",
    },
    {
      title: "Completed Tickets",
      sub: "Resolved / Closed / Cancelled",
      value: overview?.completed ?? 0,
      icon: "check",
      tone: "green",
    },
  ];

  const slaCounts = overview?.bySlaStatus || [];
  const maxSlaCount = Math.max(1, ...slaCounts.map((x) => x.count || 0));
  const maxStaffOverdue = Math.max(
    1,
    ...staffPerf.map((s) => s.overdueCount || 0),
  );
  const trendPoints = overview?.completedTrend || [];
  const maxTrend = Math.max(1, ...trendPoints.map((p) => p.count || 0));
  const totalPages = Math.max(
    1,
    Math.ceil((ticketsData.total || 0) / (ticketsData.pageSize || 10)),
  );

  return (
    <div className="sla-dashboard-section">
      <div className="sla-section-header">
        <div>
          <div className="eyebrow">SLA & TIME TRACKING MONITOR (24H POLICY)</div>
          <h2>Giám sát thời gian xử lý & SLA</h2>
          <p>
            Theo dõi thời gian xử lý thực tế (quy tắc SLA 24 giờ liên tục), cảnh báo sắp quá hạn (20h) và quá hạn (24h).
          </p>
        </div>
        <div className="sla-avg-box">
          <span>Thời gian giải quyết trung bình</span>
          <strong>
            {overview?.averageResolutionHours
              ? `${overview.averageResolutionHours} giờ`
              : "0 giờ"}
          </strong>
          <small>Tính trên chu kỳ hiện tại của Ticket đã hoàn thành</small>
        </div>
      </div>

      {err && <Err msg={err} />}

      {/* 5 SLA Summary Cards */}
      <div className="sla-metric-grid">
        {cards.map((c) => (
          <div className={`metric-card sla-card-${c.tone}`} key={c.title}>
            <div className="metric-top">
              <span>{c.title}</span>
              <span className={`metric-icon ${c.tone}`}>
                <Icon name={c.icon} size={19} />
              </span>
            </div>
            <div className="metric-value">
              {loadingOverview && !overview ? "…" : c.value}
            </div>
            <p>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* SLA Charts Row */}
      <div className="dashboard-grid sla-charts-grid">
        {/* Chart 1: Số lượng Ticket theo tình trạng SLA */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Phân bố theo tình trạng SLA</h3>
              <p>Số lượng Ticket theo 4 mức SLA (Normal, Warning, Overdue, Completed)</p>
            </div>
          </div>
          <div className="status-report">
            {["NORMAL", "WARNING", "OVERDUE", "COMPLETED"].map((key) => {
              const found = slaCounts.find((x) => x.slaStatus === key);
              const count = found?.count || 0;
              const meta = SLA_META[key];
              return (
                <div className="status-report-row sla-dist-row" key={key}>
                  <span className="sla-dist-label">
                    <i style={{ background: meta.color }} />
                    {meta.short} <small>({meta.label})</small>
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
        </section>

        {/* Chart 2: Xu hướng Ticket hoàn thành theo ngày */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Xu hướng Ticket hoàn thành</h3>
              <p>Số lượng Ticket hoàn thành theo ngày (giờ Việt Nam)</p>
            </div>
          </div>
          {trendPoints.length === 0 ? (
            <p className="muted chart-empty">Chưa có Ticket hoàn thành trong kỳ.</p>
          ) : (
            <div className="day-chart" role="img" aria-label="Xu hướng hoàn thành">
              {trendPoints.map((p) => (
                <div className="day-col" key={p.date}>
                  <span>{p.count}</span>
                  <div className="day-bar-track">
                    <div
                      className="sla-trend-bar"
                      style={{ height: `${(p.count / maxTrend) * 100}%` }}
                    />
                  </div>
                  <small>{p.date.slice(5)}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Chart 3: Hiệu suất & Ticket quá hạn theo từng Support Staff */}
      <section className="panel sla-staff-panel">
        <div className="panel-heading">
          <div>
            <h3>
              {isAdmin
                ? "Hiệu suất SLA & Ticket quá hạn theo Support Staff"
                : "Chỉ số SLA cá nhân của bạn"}
            </h3>
            <p>
              Thống kê số lượng Ticket đang xử lý, sắp quá hạn, quá hạn và thời gian xử lý trung bình (giờ)
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nhân viên hỗ trợ</th>
                <th>Đang xử lý (Active)</th>
                <th>Trong hạn (Normal)</th>
                <th>Sắp quá hạn (Warning)</th>
                <th>Quá hạn (Overdue)</th>
                <th>Đã hoàn thành</th>
                <th>TG xử lý TB</th>
                <th>Tỷ lệ quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {staffPerf.map((s) => (
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
                        s.warningCount > 0 ? "sla-num-warning" : "muted"
                      }
                    >
                      {s.warningCount}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        s.overdueCount > 0 ? "sla-num-overdue" : "muted"
                      }
                    >
                      {s.overdueCount}
                    </span>
                  </td>
                  <td>{s.completedCount}</td>
                  <td>
                    <strong>
                      {s.averageResolutionHours > 0
                        ? `${s.averageResolutionHours}h`
                        : "—"}
                    </strong>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <div className="progress-track">
                      <div
                        className="sla-bar-overdue"
                        style={{
                          width: `${
                            s.overdueCount > 0
                              ? (s.overdueCount / maxStaffOverdue) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {staffPerf.length === 0 && (
                <tr>
                  <td colSpan={8}>
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

      {/* Danh sách Ticket Monitoring */}
      <section className="panel sla-tickets-panel">
        <div className="panel-heading">
          <div>
            <h3>Danh sách giám sát thời gian Ticket (SLA Monitoring)</h3>
            <p>
              Theo dõi Elapsed Time, SLA Deadline (24h), Remaining Time và tiến độ sử dụng thời gian của từng Ticket
            </p>
          </div>
          <span className="panel-meta">{ticketsData.total} ticket</span>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar sla-filter-bar">
          <div className="search-input">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder="Tìm mã hoặc tiêu đề ticket…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>

          <select
            value={slaStatus}
            onChange={(e) => {
              setPage(1);
              setSlaStatus(e.target.value);
            }}
            aria-label="Lọc theo trạng thái SLA"
          >
            <option value="">Tất cả SLA Status</option>
            <option value="OVERDUE">OVERDUE (Quá hạn ≥ 24h)</option>
            <option value="WARNING">WARNING (Sắp quá hạn 20h–24h)</option>
            <option value="NORMAL">NORMAL (Trong hạn &lt; 20h)</option>
            <option value="COMPLETED">COMPLETED (Đã hoàn thành)</option>
          </select>

          <select
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value);
            }}
            aria-label="Lọc theo mức độ ưu tiên"
          >
            <option value="">Tất cả mức ưu tiên</option>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            aria-label="Lọc theo trạng thái Ticket"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {isAdmin && (
            <select
              value={staffId}
              onChange={(e) => {
                setPage(1);
                setStaffId(e.target.value);
              }}
              aria-label="Lọc theo nhân viên hỗ trợ"
            >
              <option value="">Tất cả Support Staff</option>
              {staffPerf.map((s) => (
                <option key={s.staffId} value={s.staffId}>
                  {s.staffName}
                </option>
              ))}
            </select>
          )}

          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
            aria-label="Sắp xếp"
          >
            <option value="overdue_desc">Ưu tiên quá hạn nhất</option>
            <option value="remaining_asc">Thời gian còn lại ít nhất</option>
            <option value="elapsed_desc">Thời gian đã xử lý lâu nhất</option>
            <option value="created_desc">Mới tạo gần nhất</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã Ticket</th>
                <th>Tiêu đề</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Nhân viên phụ trách</th>
                <th>Ngày tạo / Bắt đầu SLA</th>
                <th>Hạn SLA (24h)</th>
                <th>Tiến độ thời gian (Elapsed / Remaining)</th>
                <th>SLA Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingTickets ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty" role="status">
                      Đang tải dữ liệu giám sát SLA…
                    </div>
                  </td>
                </tr>
              ) : ticketsData.items.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <Empty
                      title="Không có ticket phù hợp"
                      description="Thử thay đổi bộ lọc SLA hoặc từ khóa tìm kiếm."
                    />
                  </td>
                </tr>
              ) : (
                ticketsData.items.map((t) => {
                  const meta = SLA_META[t.slaStatus] || SLA_META.NORMAL;
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
                        <Link className="ticket-code" to={`/tickets/${t.id}`}>
                          {t.code}
                        </Link>
                        {t.isReopened && (
                          <span
                            className="sla-reopen-tag"
                            title="Ticket được mở lại, tính chu kỳ SLA mới"
                          >
                            Reopened
                          </span>
                        )}
                      </td>
                      <td>
                        <Link className="table-title" to={`/tickets/${t.id}`}>
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
                      <td>
                        {t.assignedTo || (
                          <span className="muted">Chưa phân công</span>
                        )}
                      </td>
                      <td className="nowrap">
                        <div>{fmt(t.createdAt)}</div>
                        {t.isReopened && (
                          <small className="subtle">
                            Mở lại: {fmt(t.slaStartAt)}
                          </small>
                        )}
                      </td>
                      <td className="nowrap">{fmt(t.slaDeadline)}</td>
                      <td style={{ minWidth: 215 }}>
                        <div className="sla-progress-cell">
                          <div className="sla-progress-top">
                            <strong>
                              Đã qua:{" "}
                              {formatDurationMinutes(t.elapsedMinutes)} (
                              {t.elapsedHours}h)
                            </strong>
                            <span
                              className={`sla-rem-text sla-rem-${t.slaStatus.toLowerCase()}`}
                            >
                              {formatRemaining(t)}
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
                        <SlaBadge status={t.slaStatus} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {ticketsData.total > ticketsData.pageSize && (
          <div className="pagination">
            <span>
              Trang {ticketsData.page} / {totalPages} ({ticketsData.total}{" "}
              ticket)
            </span>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
