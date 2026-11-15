import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Err,
  Icon,
  Loading,
  PageHeader,
  TicketTable,
  STATUS_LABEL,
  STATUS_COLOR,
  PRIORITY_LABEL,
} from "../ui";
import SlaDashboardSection from "../SlaDashboardSection";

const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

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

function inRange(ticket, from, to) {
  if (!from && !to) return true;
  const t = ticketTime(ticket.createdAt);
  if (!t) return false;
  const start = from ? new Date(from + "T00:00:00").getTime() : 0;
  const end = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
  return t >= start && t <= end;
}

const PR_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function closedLast(items) {
  const end = (s) => (s === "Closed" || s === "Cancelled" ? 1 : 0);
  return [...items].sort(
    (a, b) =>
      end(a.status) - end(b.status) ||
      (PR_RANK[b.priority] || 0) - (PR_RANK[a.priority] || 0) ||
      ticketTime(b.createdAt) - ticketTime(a.createdAt),
  );
}

function statsFrom(tickets) {
  const byStatus = {};
  const byPriority = {};
  const byCategory = {};
  const byStaff = {};
  const series = {};
  let overdue = 0;
  const now = Date.now();
  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    if (t.category) byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    if (t.assignedTo) {
      const row = byStaff[t.assignedTo] || { staff: t.assignedTo, total: 0, done: 0 };
      row.total += 1;
      if (t.status === "Resolved" || t.status === "Closed") row.done += 1;
      byStaff[t.assignedTo] = row;
    }
    const day = ymd(new Date(ticketTime(t.createdAt)));
    series[day] = (series[day] || 0) + 1;
    const due = ticketTime(t.dueDate);
    if (
      due &&
      due < now &&
      !["Resolved", "Closed", "Cancelled"].includes(t.status)
    )
      overdue += 1;
  }
  return {
    total: tickets.length,
    byStatus,
    byPriority,
    overdue,
    series: Object.entries(series).map(([date, count]) => ({ date, count })),
    byCategory: Object.entries(byCategory).map(([category, count]) => ({
      category,
      count,
    })),
    byStaff: Object.values(byStaff),
  };
}
function fillDays(from, to, series) {
  const map = new Map((series || []).map((x) => [x.date, x.count]));
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
  if (!points.length) return <p className="muted chart-empty">Chưa có dữ liệu.</p>;
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

export default function Dashboard() {
  const { user } = useAuth();
  const statsRole = user.role === "Admin" || user.role === "Staff";
  const initial = statsRole ? rangeOf("month") : { from: "", to: "" };
  const [server, setServer] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [rating, setRating] = useState(null);
  const [err, setErr] = useState("");
  const [recentErr, setRecentErr] = useState("");
  const [preset, setPreset] = useState(statsRole ? "month" : "");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const apply = () => {
    let start = from;
    let end = to;
    if (start && end && start > end) [start, end] = [end, start];
    setFrom(start);
    setTo(end);
    setApplied({ from: start, to: end });
  };
  useEffect(() => {
    let active = true;
    api("/tickets?pageSize=50")
      .then((v) => {
        if (active) setTickets(v?.items || []);
      })
      .catch((e) => {
        if (active) {
          setRecentErr(e.message);
          setTickets([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    api("/dashboard")
      .then((v) => {
        if (!active || !v) return;
        if (statsRole) setRating(v.averageRating ?? null);
        else setServer(v);
      })
      .catch((e) => {
        if (active && !statsRole) setErr(e.message);
      });
    return () => {
      active = false;
    };
  }, [statsRole]);
  const stats = statsRole
    ? tickets && {
        ...statsFrom(
          tickets.filter((t) => inRange(t, applied.from, applied.to)),
        ),
        averageRating: rating,
      }
    : server;
  const greet =
    new Date().getHours() < 12
      ? "Chào buổi sáng"
      : new Date().getHours() < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";
  const counts = stats?.byStatus || {};
  const metrics = [
    [
      "Tổng yêu cầu",
      stats?.total || 0,
      "ticket",
      "blue",
      "Ticket trong phạm vi của bạn",
    ],
    ["Chờ tiếp nhận", counts.Open || 0, "clock", "orange", "Đang chờ xử lý"],
    [
      "Đang xử lý",
      (counts.InProgress || 0) + (counts.Pending || 0),
      "activity",
      "purple",
      "Bao gồm chờ phản hồi",
    ],
    [
      "Đã giải quyết",
      (counts.Resolved || 0) + (counts.Closed || 0),
      "check",
      "green",
      "Đã giải quyết và đã đóng",
    ],
  ];
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
  const quick =
    user.role === "Admin"
      ? [
          [
            "/tickets",
            "ticket",
            "Phân công & xử lý ticket",
            "Mở ticket để phân công nhân viên",
          ],
          [
            "/admin",
            "users",
            "Quản lý người dùng",
            "Tài khoản và quyền truy cập",
          ],
          [
            "/admin/categories",
            "folder",
            "Danh mục sự cố",
            "Quản lý các nhóm yêu cầu hỗ trợ",
          ],
        ]
      : [
          ...(user.role === "User"
            ? [
                [
                  "/tickets/new",
                  "plus",
                  "Tạo yêu cầu hỗ trợ",
                  "Gửi sự cố mới đến bộ phận IT",
                ],
              ]
            : []),
          [
            "/tickets",
            "ticket",
            user.role === "Staff" ? "Ticket được giao" : "Theo dõi yêu cầu",
            "Kiểm tra trạng thái và phản hồi",
          ],
        ];
  return (
    <>
      <PageHeader
        eyebrow="TỔNG QUAN / DASHBOARD"
        title={`${greet}, ${user.fullName?.split(" ").slice(-1)[0] || "bạn"} 👋`}
        description={
          user.role === "Admin"
            ? "Tình hình hoạt động hỗ trợ kỹ thuật trên toàn hệ thống."
            : "Theo dõi tiến độ các yêu cầu hỗ trợ của bạn một cách dễ dàng."
        }
        action={
          user.role !== "Staff" && (
            <Link className="btn btn-primary" to="/tickets/new">
              <Icon name="plus" />
              Tạo yêu cầu mới
            </Link>
          )
        }
      />
      {statsRole && (
        <div className="range-bar">
          {[
            ["day", "Hôm nay"],
            ["week", "Tuần này"],
            ["month", "Tháng này"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-small ${preset === key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                const r = rangeOf(key);
                setPreset(key);
                setFrom(r.from);
                setTo(r.to);
              }}
            >
              {label}
            </button>
          ))}
          <label>
            Từ
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("");
                setFrom(e.target.value);
              }}
            />
          </label>
          <label>
            Đến
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("");
                setTo(e.target.value);
              }}
            />
          </label>
          <button type="button" className="btn btn-primary btn-small" onClick={apply}>
            Áp dụng
          </button>
        </div>
      )}
      {err ? (
        <Err msg={err} />
      ) : !stats ? (
        <Loading />
      ) : (
        <>
          <div className="metric-grid">
            {metrics.map(([name, count, icon, tone, hint]) => (
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
          <div className="dashboard-grid">
            <section className="panel overview-panel">
              <div className="panel-heading">
                <div>
                  <h3>Phân bố trạng thái</h3>
                  <p>Tổng quan Ticket theo tiến độ</p>
                </div>
                <span className="panel-meta">{stats.total} yêu cầu</span>
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
                    <strong>{stats.total}</strong>
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
                {quick.map(([to, icon, name, desc]) => (
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
                <Icon name="alert" />
                <span>
                  {stats.overdue
                    ? `${stats.overdue} yêu cầu đã quá hạn xử lý.`
                    : "Mô tả sự cố rõ ràng giúp đội ngũ IT hỗ trợ nhanh hơn."}
                </span>
              </div>
            </section>
          </div>
          {statsRole && (
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Ticket theo ngày</h3>
                    <p>Số yêu cầu tạo trong từng ngày</p>
                  </div>
                </div>
                <DayChart points={fillDays(applied.from, applied.to, stats.series)} />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Mức độ ưu tiên</h3>
                    <p>Phân bố trong khoảng đã chọn</p>
                  </div>
                </div>
                <div className="status-report">
                  {PRIORITY_ORDER.map((p) => {
                    const n = stats.byPriority?.[p] || 0;
                    const max = Math.max(
                      1,
                      ...PRIORITY_ORDER.map((k) => stats.byPriority?.[k] || 0),
                    );
                    return (
                      <div className="status-report-row" key={p}>
                        <span>{PRIORITY_LABEL[p]}</span>
                        <div className="progress-track">
                          <div style={{ width: `${(n / max) * 100}%` }} />
                        </div>
                        <strong>{n}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
          {user.role === "Admin" && (
            <div className="dashboard-grid admin-summary">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Theo danh mục</h3>
                    <p>Phân bố yêu cầu theo nhóm sự cố</p>
                  </div>
                </div>
                <div className="status-report">
                  {stats.byCategory?.length ? (
                    stats.byCategory.map((x) => (
                      <div className="status-report-row" key={x.category}>
                        <span>{x.category}</span>
                        <div className="progress-track">
                          <div
                            style={{
                              width: `${stats.total ? (x.count / stats.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{x.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Chưa có dữ liệu.</p>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Hiệu suất hỗ trợ</h3>
                    <p>
                      Điểm hài lòng:{" "}
                      {stats.averageRating
                        ? Number(stats.averageRating).toFixed(1) + " / 5"
                        : "Chưa có đánh giá"}
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Được giao</th>
                        <th>Hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byStaff?.map((x) => (
                        <tr key={x.staff}>
                          <td>{x.staff}</td>
                          <td>{x.total}</td>
                          <td>{x.done}</td>
                        </tr>
                      ))}
                      {!stats.byStaff?.length && (
                        <tr>
                          <td colSpan="3">Chưa có dữ liệu.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {statsRole && (
            <SlaDashboardSection user={user} from={from} to={to} />
          )}
        </>
      )}
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h3>Danh sách yêu cầu</h3>
            <p>Các ticket trong phạm vi của bạn</p>
          </div>
          <Link className="link-arrow" to="/tickets">
            Xem tất cả <Icon name="arrow" size={16} />
          </Link>
        </div>
        {recentErr ? (
          <div className="panel-body">
            <Err msg={recentErr} />
          </div>
        ) : (
          <TicketTable
            items={closedLast(tickets || []).slice(0, 5)}
            loading={tickets === null}
          />
        )}
      </section>
    </>
  );
}
