export const STATUS_LABEL = {
  Open: 'Open', InProgress: 'In Progress', Pending: 'Pending',
  Resolved: 'Resolved', Closed: 'Closed', Cancelled: 'Cancelled'
};

export const StatusBadge = ({ s }) => <span className={`badge st-${s}`}>{STATUS_LABEL[s] || s}</span>;
export const PriorityBadge = ({ p }) => <span className={`badge pr-${p}`}>{p}</span>;

// Server trả UTC không kèm 'Z' -> thêm 'Z' để hiển thị đúng giờ địa phương
export const fmt = (d) => (d ? new Date(/Z$|[+-]\d\d:\d\d$/.test(d) ? d : d + 'Z').toLocaleString('vi-VN') : '-');

export const Err = ({ msg }) => (msg ? <div className="error">{msg}</div> : null);
