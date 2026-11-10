import { Link } from "react-router-dom";

export const STATUS_LABEL = {
  Open: "Mới tạo",
  InProgress: "Đang xử lý",
  Pending: "Chờ phản hồi",
  Resolved: "Đã giải quyết",
  Closed: "Đã đóng",
  Cancelled: "Đã hủy",
};
export const PRIORITY_LABEL = {
  Low: "Thấp",
  Medium: "Trung bình",
  High: "Cao",
  Critical: "Khẩn cấp",
};
export const ROLE_LABEL = {
  User: "Người dùng",
  Staff: "Nhân viên IT",
  Admin: "Quản trị viên",
};
export const STATUS_COLOR = {
  Open: "#4088f4",
  InProgress: "#865ef0",
  Pending: "#efb44f",
  Resolved: "#25b58c",
  Closed: "#55a68d",
  Cancelled: "#a5afbf",
};

const paths = {
  headset:
    "M3 14v-3a9 9 0 0 1 18 0v3M3 13h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 1-2Zm18 0h-3v8h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-1-2ZM18 21a6 6 0 0 1-6 2",
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  ticket: "M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6ZM14 4v3m0 3v4m0 3v3",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  folder: "M3 7V4h6l2 3h10v13H3ZM3 11h18",
  chart: "M3 3v18h18M7 16v-5m5 5V7m5 9v-9",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  logout: "M9 21H3V3h6m6 5 4 4-4 4M8 12h13",
  help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 3m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  activity: "M2 12h5l3-9 4 18 3-9h5",
  check: "m5 12 4 4L19 6",
  alert: "m12 3 10 18H2ZM12 9v4m0 4h.01",
  mail: "M3 4h18v16H3ZM3 5l9 7 9-7",
  lock: "M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m6 9 6 6 6-6",
  back: "M19 12H5m6-6-6 6 6 6",
};
export function Icon({ name, size = 19, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.ticket} />
    </svg>
  );
}
export const Avatar = ({ name = "", className = "" }) => (
  <span className={`avatar ${className}`}>
    {name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "IT"}
  </span>
);
export const StatusBadge = ({ s }) => (
  <span className={`badge st-${s}`}>{STATUS_LABEL[s] || s}</span>
);
export const PriorityBadge = ({ p }) => (
  <span className={`badge pr-${p}`}>{PRIORITY_LABEL[p] || p}</span>
);
// Backend trả UTC không kèm Z.
export const fmt = (d) =>
  d
    ? new Date(/Z$|[+-]\d\d:\d\d$/.test(d) ? d : d + "Z").toLocaleString(
        "vi-VN",
      )
    : "—";
export const Err = ({ msg }) =>
  msg ? (
    <div className="form-error" role="alert">
      {msg}
    </div>
  ) : null;
export const PageHeader = ({ eyebrow, title, description, action }) => (
  <div className="page-header">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action}
  </div>
);
export const Loading = () => (
  <div className="panel empty" role="status">
    <span className="spinner" />
    <strong>Đang tải dữ liệu…</strong>
  </div>
);
export const Empty = ({
  title = "Chưa có yêu cầu nào",
  description = "Các yêu cầu hỗ trợ sẽ xuất hiện tại đây.",
}) => (
  <div className="empty">
    <Icon name="ticket" size={32} />
    <strong>{title}</strong>
    <span>{description}</span>
  </div>
);
export function TicketTable({ items = [], loading = false }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Mã ticket</th>
            <th>Tiêu đề / Danh mục</th>
            <th>Ưu tiên</th>
            <th>Trạng thái</th>
            <th>Người xử lý</th>
            <th>Ngày tạo</th>
            <th>
              <span className="sr-only">Chi tiết</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="7">
                <div className="empty" role="status">
                  Đang tải yêu cầu…
                </div>
              </td>
            </tr>
          ) : (
            items.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link className="ticket-code" to={`/tickets/${t.id}`}>
                    {t.code}
                  </Link>
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
                <td className="nowrap">{fmt(t.createdAt)}</td>
                <td>
                  <Link
                    className="icon-action"
                    to={`/tickets/${t.id}`}
                    aria-label={`Xem ${t.code}`}
                  >
                    <Icon name="arrow" size={16} />
                  </Link>
                </td>
              </tr>
            ))
          )}
          {!loading && !items.length && (
            <tr>
              <td colSpan="7">
                <Empty />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
