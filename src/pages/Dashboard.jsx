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
} from "../ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState("");
  const [recentErr, setRecentErr] = useState("");
  const [recentLoading, setRecentLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api("/dashboard")
      .then((v) => {
        if (active) setD(v);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      });
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
          user.role === "User" && (
            <Link className="btn btn-primary" to="/tickets/new">
              <Icon name="plus" />
              Tạo yêu cầu mới
            </Link>
          )
        }
      />
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
