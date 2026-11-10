import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import TicketForm from "../TicketForm";
import {
  Avatar,
  Err,
  Icon,
  Loading,
  PageHeader,
  PriorityBadge,
  StatusBadge,
  fmt,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "../ui";

// Backend vẫn xác thực quyền và các bước chuyển trạng thái.
function actionsFor(t, me) {
  const staff = me.role === "Staff" && t.assignedToId === me.userId;
  const owner = t.createdById === me.userId;
  const a = [];
  if (staff && t.status === "Open") a.push(["InProgress", "Bắt đầu xử lý"]);
  if (staff && t.status === "InProgress")
    a.push(["Pending", "Chờ phản hồi"], ["Resolved", "Đã xử lý xong"]);
  if (staff && t.status === "Pending") a.push(["InProgress", "Tiếp tục xử lý"]);
  if (owner && t.status === "Resolved")
    a.push(["Closed", "Xác nhận đã hết lỗi"], ["InProgress", "Vẫn còn lỗi"]);
  if (owner && t.status === "Open") a.push(["Cancelled", "Hủy yêu cầu"]);
  return a;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [t, setT] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [staff, setStaff] = useState([]);
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [staffId, setStaffId] = useState("");
  const [due, setDue] = useState("");
  const [fb, setFb] = useState({ rating: 5, comment: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchDetail = async () => {
    const [ticket, c, h, f, s] = await Promise.all([
      api(`/tickets/${id}`),
      api(`/tickets/${id}/comments`),
      api(`/tickets/${id}/history`),
      api(`/tickets/${id}/feedback`).catch(() => null),
      user.role === "Admin" ? api("/users/support-staff") : Promise.resolve([]),
    ]);
    return { ticket, c, h, f, s };
  };
  const apply = ({ ticket, c, h, f, s }) => {
    setT(ticket);
    setComments(c || []);
    setHistory(h || []);
    setFeedback(f);
    setStaff(s || []);
  };
  useEffect(() => {
    let active = true;
    setT(null);
    setEditingId(null);
    setErr("");
    setStaffId("");
    setDue("");
    setNote("");
    setText("");
    fetchDetail()
      .then((v) => {
        if (active) apply(v);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, user.role]);
  const run = async (fn) => {
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await fn();
      apply(await fetchDetail());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = (status) => {
    if (status === "Resolved" && !note.trim()) {
      setErr("Vui lòng nhập ghi chú xử lý trước khi hoàn tất yêu cầu.");
      return;
    }
    run(async () => {
      await api(`/tickets/${id}/status`, {
        method: "PATCH",
        body: { status, note: note || null },
      });
      setNote("");
    });
  };
  const addComment = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    run(async () => {
      await api(`/tickets/${id}/comments`, {
        method: "POST",
        body: { content: text },
      });
      setText("");
    });
  };
  const assign = (e) => {
    e.preventDefault();
    run(() =>
      api(`/tickets/${id}/assign`, {
        method: "PATCH",
        body: {
          staffId: +staffId,
          dueDate: due ? new Date(due).toISOString() : null,
        },
      }),
    );
  };
  const sendFeedback = (e) => {
    e.preventDefault();
    run(() =>
      api(`/tickets/${id}/feedback`, {
        method: "POST",
        body: { rating: +fb.rating, comment: fb.comment || null },
      }),
    );
  };
  if (!t)
    return (
      <>
        <div className="detail-top-link">
          <Link to="/tickets">
            <Icon name="back" size={16} />
            Quay lại danh sách
          </Link>
        </div>
        {err ? <Err msg={err} /> : <Loading />}
      </>
    );
  const actions = actionsFor(t, user);
  const closed = ["Closed", "Cancelled"].includes(t.status);
  const canEdit =
    user.role !== "Staff" && t.createdById === user.userId && t.status === "Open";
  const saveTicket = async (fields) => {
    const saved = await api(`/tickets/${id}`, { method: "PUT", body: fields });
    if (saved) {
      setT((current) => (current?.id === saved.id ? saved : current));
      setEditingId((current) => (current === saved.id ? null : current));
    }
  };
  return (
    <>
      <div className="detail-top-link">
        <Link to="/tickets">
          <Icon name="back" size={16} />
          Quay lại danh sách ticket
        </Link>
      </div>
      <PageHeader
        eyebrow={`TICKET / ${t.code}`}
        title={t.title}
        description={`Tạo lúc ${fmt(t.createdAt)}`}
        action={
          <div className="badge-group">
            <StatusBadge s={t.status} />
            <PriorityBadge p={t.priority} />
          </div>
        }
      />
      <Err msg={err} />
      <div className="detail-grid">
        <div className="detail-main">
          {canEdit && editingId === t.id ? (
            <TicketForm
              key={t.id}
              ticket={t}
              onSave={saveTicket}
              cancel={(saving) => (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setEditingId(null)}
                >
                  Hủy bỏ
                </button>
              )}
            />
          ) : (
            <section className="panel detail-section">
              <div className="detail-section-heading">
                <h3>Thông tin yêu cầu</h3>
                {canEdit && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditingId(t.id)}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>
              <p className="description-text">{t.description}</p>
              <div className="detail-props">
                <div>
                  <span>Danh mục sự cố</span>
                  <strong>{t.category}</strong>
                </div>
                <div>
                  <span>Hạn xử lý</span>
                  <strong>{fmt(t.dueDate)}</strong>
                </div>
                <div>
                  <span>Mức độ ưu tiên</span>
                  <PriorityBadge p={t.priority} />
                </div>
                <div>
                  <span>Trạng thái</span>
                  <StatusBadge s={t.status} />
                </div>
              </div>
            </section>
          )}
          <section className="panel detail-section">
            <h3>
              Trao đổi <span className="muted">({comments.length})</span>
            </h3>
            <div className="comments">
              {comments.map((c) => (
                <div className="comment" key={c.id}>
                  <Avatar name={c.userName} />
                  <div className="comment-content">
                    <div className="comment-meta">
                      <strong>{c.userName}</strong>
                      <span>{fmt(c.createdAt)}</span>
                    </div>
                    <p className="preserve-text">{c.content}</p>
                  </div>
                </div>
              ))}
              {!comments.length && (
                <div className="comments-empty">
                  Chưa có bình luận. Bắt đầu trao đổi tại đây.
                </div>
              )}
            </div>
            {!closed && (
              <form className="comment-form" onSubmit={addComment}>
                <label className="sr-only" htmlFor="comment">
                  Nội dung bình luận
                </label>
                <textarea
                  id="comment"
                  rows="3"
                  placeholder="Viết bình luận hoặc cập nhật thông tin…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                />
                <div>
                  <span>
                    Trao đổi trực tiếp với người tham gia xử lý yêu cầu.
                  </span>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !text.trim()}
                  >
                    Gửi bình luận
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className="panel detail-section">
            <h3>Lịch sử trạng thái</h3>
            <div className="timeline">
              {history.map((h, i) => (
                <div className="timeline-item" key={i}>
                  <span className="timeline-marker" />
                  <div>
                    <strong>
                      {STATUS_LABEL[h.oldStatus] || h.oldStatus || "Khởi tạo"} →{" "}
                      {STATUS_LABEL[h.newStatus] || h.newStatus}
                    </strong>
                    <span>
                      {h.changedBy} · {fmt(h.changedAt)}
                    </span>
                    {h.note && <p className="preserve-text">{h.note}</p>}
                  </div>
                </div>
              ))}
              {!history.length && (
                <p className="muted">Chưa có thay đổi trạng thái.</p>
              )}
            </div>
          </section>
          {(feedback ||
            (t.status === "Closed" && t.createdById === user.userId)) && (
            <section className="panel detail-section">
              <h3>Đánh giá chất lượng hỗ trợ</h3>
              {feedback ? (
                <>
                  <div
                    className="rating-display"
                    aria-label={`${feedback.rating} trên 5 sao`}
                  >
                    {"★".repeat(feedback.rating)}
                    {"☆".repeat(5 - feedback.rating)}
                  </div>
                  <p className="description-text">
                    {feedback.comment || "Cảm ơn bạn đã đánh giá!"}
                  </p>
                </>
              ) : (
                <form onSubmit={sendFeedback}>
                  <div
                    className="rating-picker"
                    role="group"
                    aria-label="Điểm đánh giá"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={n <= fb.rating ? "star-selected" : ""}
                        aria-label={`${n} sao`}
                        aria-pressed={fb.rating === n}
                        onClick={() => setFb({ ...fb, rating: n })}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <label className="form-label">
                    Nhận xét
                    <textarea
                      rows="3"
                      value={fb.comment}
                      onChange={(e) =>
                        setFb({ ...fb, comment: e.target.value })
                      }
                      placeholder="Chia sẻ trải nghiệm hỗ trợ của bạn…"
                    />
                  </label>
                  <button className="btn btn-primary" disabled={busy}>
                    Gửi đánh giá
                  </button>
                </form>
              )}
            </section>
          )}
        </div>
        <aside className="detail-side">
          <section className="panel side-panel">
            <h3>Người tham gia</h3>
            <div className="person-row">
              <Avatar name={t.createdBy} />
              <div>
                <small>Người tạo yêu cầu</small>
                <strong>{t.createdBy}</strong>
              </div>
            </div>
            <div className="person-row">
              <Avatar name={t.assignedTo || "IT"} className="staff-avatar" />
              <div>
                <small>Nhân viên xử lý</small>
                <strong>{t.assignedTo || "Chưa phân công"}</strong>
              </div>
            </div>
          </section>
          {actions.length > 0 && (
            <section className="panel side-panel">
              <h3>Cập nhật tiến độ</h3>
              <label className="form-label">
                Ghi chú xử lý
                <textarea
                  rows="3"
                  placeholder="Bắt buộc khi hoàn tất xử lý"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="action-stack">
                {actions.map(([s, label]) => (
                  <button
                    key={s}
                    className={`btn ${s === "Cancelled" ? "btn-secondary" : "btn-primary"}`}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}
          {user.role === "Admin" && !closed && (
            <section className="panel side-panel">
              <h3>Phân công & ưu tiên</h3>
              <form onSubmit={assign}>
                <label className="form-label">
                  Nhân viên IT
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                  >
                    <option value="">Chọn nhân viên</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Hạn xử lý
                  <input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn-primary full-btn"
                  disabled={busy || !staffId}
                >
                  Phân công ticket
                </button>
              </form>
              <label className="form-label priority-control">
                Mức độ ưu tiên
                <select
                  value={t.priority}
                  disabled={busy}
                  onChange={(e) =>
                    run(() =>
                      api(`/tickets/${id}/priority`, {
                        method: "PATCH",
                        body: { priority: e.target.value },
                      }),
                    )
                  }
                >
                  {Object.entries(PRIORITY_LABEL).map(([p, label]) => (
                    <option key={p} value={p}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
          <div className="detail-tip">
            <Icon name="help" size={24} />
            <span>
              Mọi thay đổi trạng thái đều được ghi lại để bạn dễ dàng theo dõi.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
