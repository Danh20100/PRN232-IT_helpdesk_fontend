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
  const [d, setD] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState("");
  const [recentErr, setRecentErr] = useState("");
  const [recentLoading, setRecentLoading] = useState(true);
  const [preset, setPreset] = useState(statsRole ? "month" : "");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  useEffect(() => {
    let active = true;
    setErr("");
    const p = new URLSearchParams();
    if (statsRole && from) p.set("from", from);
    if (statsRole && to) p.set("to", to);
    api("/dashboard" + (p.toString() ? "?" + p : ""))
      .then((v) => {
        if (active) setD(v);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      });
    return () => {
      active = false;
    };
  }, [from, to, statsRole]);
  useEffect(() => {
    let active = true;
    api("/tickets?page=1&pageSize=5")
      .then((v) => {
        if (active) setRecent(v?.items || []);
      })
      .catch((e) => {
        if (active) setRecentErr(e.message);
      })
      .finally(() => {
        if (active) setRecentLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const greet =
    new Date().getHours() < 12
      ? "Chào buổi sáng"
      : new Date().getHours() < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";
  const counts = d?.byStatus || {};
  const metrics = [
    [
      "Tổng yêu cầu",
      d?.total || 0,
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
        </div>
      )}
      {err ? (
        <Err msg={err} />
      ) : !d ? (
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
                <span className="panel-meta">{d.total} yêu cầu</span>
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
                    <strong>{d.total}</strong>
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
                  {d.overdue
                    ? `${d.overdue} yêu cầu đã quá hạn xử lý.`
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
                <DayChart points={fillDays(from, to, d.series)} />
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
                    const n = d.byPriority?.[p] || 0;
                    const max = Math.max(
                      1,
                      ...PRIORITY_ORDER.map((k) => d.byPriority?.[k] || 0),
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
                  {d.byCategory?.length ? (
                    d.byCategory.map((x) => (
                      <div className="status-report-row" key={x.category}>
                        <span>{x.category}</span>
                        <div className="progress-track">
                          <div
                            style={{
                              width: `${d.total ? (x.count / d.total) * 100 : 0}%`,
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
                      {d.averageRating
                        ? Number(d.averageRating).toFixed(1) + " / 5"
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
                      {d.byStaff?.map((x) => (
                        <tr key={x.staff}>
                          <td>{x.staff}</td>
                          <td>{x.total}</td>
                          <td>{x.done}</td>
                        </tr>
                      ))}
                      {!d.byStaff?.length && (
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
          <TicketTable items={recent} loading={recentLoading} />
        )}
      </section>
    </>
  );
}
