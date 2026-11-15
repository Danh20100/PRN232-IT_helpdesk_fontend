import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Avatar,
  Empty,
  Err,
  Icon,
  Loading,
  PriorityBadge,
  StatusBadge,
  STATUS_COLOR,
  STATUS_LABEL,
  fmt,
} from "./ui";

// Thứ tự cột khớp chính xác enum TicketStatus của Backend, Closed và Cancelled ở cuối bảng.
export const KANBAN_COLUMNS = [
  "Open",
  "InProgress",
  "Pending",
  "Resolved",
  "Closed",
  "Cancelled",
];

// 5 trạng thái luồng xử lý chính và nhánh kết thúc Cancelled riêng cho Ticket Detail Progress View.
const MAIN_PROGRESS_COLUMNS = [
  "Open",
  "InProgress",
  "Pending",
  "Resolved",
  "Closed",
];
const CANCELLED_COLUMN = "Cancelled";

// Quy tắc chuyển trạng thái khớp 100% với TicketService.Rules tại Backend.
export function getAllowedTransitions(t, me) {
  if (!t || !me) return [];
  const staff = me.role === "Staff" && t.assignedToId === me.userId;
  const owner = t.createdById === me.userId;
  const moves = [];
  if (staff && t.status === "Open") {
    moves.push({
      to: "InProgress",
      label: "Bắt đầu xử lý",
      requiresNote: false,
    });
  }
  if (staff && t.status === "InProgress") {
    moves.push(
      { to: "Pending", label: "Chờ phản hồi", requiresNote: false },
      { to: "Resolved", label: "Đã xử lý xong", requiresNote: true },
    );
  }
  if (staff && t.status === "Pending") {
    moves.push({
      to: "InProgress",
      label: "Tiếp tục xử lý",
      requiresNote: false,
    });
  }
  if (owner && t.status === "Resolved") {
    moves.push(
      { to: "Closed", label: "Xác nhận đã hết lỗi", requiresNote: false },
      { to: "InProgress", label: "Vẫn còn lỗi", requiresNote: false },
    );
  } else if (me.role === "Admin" && t.status === "Resolved") {
    moves.push({ to: "Closed", label: "Đóng ticket", requiresNote: false });
  }
  if (owner && t.status === "Open") {
    moves.push({
      to: "Cancelled",
      label: "Hủy yêu cầu",
      requiresNote: false,
    });
  }
  return moves;
}

// Kiểm tra quá hạn SLA giống logic DashboardAsync ở TicketService.cs.
function isTicketOverdue(t) {
  if (!t?.dueDate) return false;
  if (["Resolved", "Closed", "Cancelled"].includes(t.status)) return false;
  const raw = t.dueDate;
  const due = new Date(/Z$|[+-]\d\d:\d\d$/.test(raw) ? raw : raw + "Z");
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export default function KanbanBoard({
  items = [],
  total = 0,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onLoadAll,
  onStatusChange,
  user,
}) {
  const nav = useNavigate();
  const [draggingTicket, setDraggingTicket] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [busyTicketId, setBusyTicketId] = useState(null);
  const [actionErr, setActionErr] = useState("");
  const [resolveModal, setResolveModal] = useState(null); // { ticket, targetStatus }
  const [resolveNote, setResolveNote] = useState("");
  const [modalErr, setModalErr] = useState("");

  if (loading) {
    return (
      <div className="kanban-loading-wrap">
        <Loading />
      </div>
    );
  }

  const allowedMoveMap = new Map();
  if (draggingTicket) {
    getAllowedTransitions(draggingTicket, user).forEach((m) => {
      allowedMoveMap.set(m.to, m);
    });
  }

  const executeStatusChange = async (ticket, targetStatus, note = null) => {
    if (busyTicketId) return false;
    setActionErr("");
    setBusyTicketId(ticket.id);
    try {
      await onStatusChange(ticket.id, targetStatus, note);
      return true;
    } catch (e) {
      setActionErr(
        `[${ticket.code}] ${e.message || "Không thể cập nhật trạng thái ticket."}`,
      );
      return false;
    } finally {
      setBusyTicketId(null);
    }
  };

  const triggerTransition = (ticket, targetStatus) => {
    if (busyTicketId) return;
    setActionErr("");
    const allowed = getAllowedTransitions(ticket, user).find(
      (m) => m.to === targetStatus,
    );
    if (!allowed) {
      setActionErr(
        `[${ticket.code}] Không thể chuyển từ "${STATUS_LABEL[ticket.status] || ticket.status}" sang "${STATUS_LABEL[targetStatus] || targetStatus}" theo phân quyền và quy trình hiện tại.`,
      );
      return;
    }
    if (allowed.requiresNote || targetStatus === "Resolved") {
      setResolveModal({ ticket, targetStatus });
      setResolveNote("");
      setModalErr("");
      return;
    }
    executeStatusChange(ticket, targetStatus, null);
  };

  const submitResolveModal = async (e) => {
    e.preventDefault();
    if (!resolveModal || busyTicketId) return;
    const trimmed = resolveNote.trim();
    if (!trimmed) {
      setModalErr("Vui lòng nhập ghi chú xử lý trước khi chuyển sang Đã giải quyết.");
      return;
    }
    setModalErr("");
    const ok = await executeStatusChange(
      resolveModal.ticket,
      resolveModal.targetStatus,
      trimmed,
    );
    if (ok) {
      setResolveModal(null);
      setResolveNote("");
    }
  };

  const handleDragStart = (e, ticket, canDrag) => {
    if (!canDrag || busyTicketId) {
      e.preventDefault();
      return;
    }
    setActionErr("");
    setDraggingTicket(ticket);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(ticket.id));
  };

  const handleDragEnd = () => {
    setDraggingTicket(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e, colStatus) => {
    if (!draggingTicket) return;
    if (draggingTicket.status === colStatus) return;
    if (allowedMoveMap.has(colStatus)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverCol !== colStatus) setDragOverCol(colStatus);
    }
  };

  const handleDragLeave = (e, colStatus) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverCol === colStatus) setDragOverCol(null);
  };

  const handleDrop = (e, colStatus) => {
    e.preventDefault();
    const ticket = draggingTicket;
    setDraggingTicket(null);
    setDragOverCol(null);
    if (!ticket || ticket.status === colStatus) return;
    triggerTransition(ticket, colStatus);
  };

  const grouped = KANBAN_COLUMNS.reduce((acc, s) => {
    acc[s] = [];
    return acc;
  }, {});
  items.forEach((t) => {
    if (grouped[t.status]) {
      grouped[t.status].push(t);
    }
  });

  const remaining = Math.max(0, total - items.length);

  return (
    <div className="kanban-wrapper">
      {actionErr && !resolveModal && (
        <div className="kanban-alert-bar">
          <Err msg={actionErr} />
          <button
            type="button"
            className="text-button"
            onClick={() => setActionErr("")}
          >
            Đóng
          </button>
        </div>
      )}

      {total > 0 && hasMore && (
        <div className="kanban-data-banner" role="status">
          <div className="kanban-data-info">
            <Icon name="alert" size={16} />
            <span>
              Đang hiển thị <strong>{items.length}</strong> /{" "}
              <strong>{total}</strong> yêu cầu trên bảng Kanban.
            </span>
          </div>
          <div className="kanban-data-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore
                ? "Đang tải thêm…"
                : `Tải thêm (${Math.min(50, remaining)} yêu cầu)`}
            </button>
            {remaining > 50 && onLoadAll && (
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={loadingMore}
                onClick={onLoadAll}
              >
                {loadingMore ? "Đang tải…" : `Tải tất cả (${total})`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="kanban-board" role="region" aria-label="Bảng Kanban Ticket">
        {KANBAN_COLUMNS.map((status) => {
          const colItems = grouped[status] || [];
          const isSourceCol = draggingTicket?.status === status;
          const isAllowedTarget = Boolean(
            draggingTicket && allowedMoveMap.has(status),
          );
          const isDisabledTarget = Boolean(
            draggingTicket && !isSourceCol && !isAllowedTarget,
          );
          const isDragOver = dragOverCol === status && isAllowedTarget;

          return (
            <section
              key={status}
              className={[
                "kanban-column",
                `kanban-col-${status}`,
                isSourceCol ? "is-source" : "",
                isAllowedTarget ? "is-drop-allowed" : "",
                isDisabledTarget ? "is-drop-disabled" : "",
                isDragOver ? "is-drag-over" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={(e) => handleDragLeave(e, status)}
              onDrop={(e) => handleDrop(e, status)}
              aria-label={`Cột ${STATUS_LABEL[status] || status}`}
            >
              <header className="kanban-column-header">
                <div className="kanban-column-title">
                  <span
                    className="kanban-status-dot"
                    style={{ background: STATUS_COLOR[status] || "#a5afbf" }}
                  />
                  <StatusBadge s={status} />
                </div>
                <span
                  className="kanban-column-count"
                  aria-label={`${colItems.length} ticket`}
                >
                  {colItems.length}
                </span>
              </header>

              {isAllowedTarget && (
                <div className="kanban-drop-hint">
                  Thả thẻ vào đây: {allowedMoveMap.get(status)?.label}
                </div>
              )}

              <div className="kanban-column-body">
                {colItems.length === 0 ? (
                  <div className="kanban-empty-col">
                    <Empty
                      title="Không có ticket"
                      description={`Chưa có yêu cầu ở trạng thái "${STATUS_LABEL[status] || status}".`}
                    />
                  </div>
                ) : (
                  colItems.map((t) => {
                    const moves = getAllowedTransitions(t, user);
                    const canDrag = moves.length > 0 && busyTicketId !== t.id;
                    const overdue = isTicketOverdue(t);
                    const isUpdating = busyTicketId === t.id;
                    const isDragging = draggingTicket?.id === t.id;

                    return (
                      <article
                        key={t.id}
                        className={[
                          "kanban-card",
                          canDrag ? "is-draggable" : "",
                          isDragging ? "is-dragging" : "",
                          isUpdating ? "is-updating" : "",
                          overdue ? "is-overdue" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, t, canDrag)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          if (!isUpdating) nav(`/tickets/${t.id}`);
                        }}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            e.target === e.currentTarget
                          ) {
                            e.preventDefault();
                            nav(`/tickets/${t.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`${t.code} - ${t.title}`}
                      >
                        <div className="kanban-card-top">
                          <Link
                            className="ticket-code"
                            to={`/tickets/${t.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.code}
                          </Link>
                          <div className="kanban-card-badges">
                            {overdue && (
                              <span
                                className="badge badge-overdue"
                                title={`Quá hạn xử lý: ${fmt(t.dueDate)}`}
                              >
                                <Icon name="alert" size={13} />
                                Quá hạn
                              </span>
                            )}
                            <PriorityBadge p={t.priority} />
                          </div>
                        </div>

                        <Link
                          className="kanban-card-title"
                          to={`/tickets/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.title}
                        </Link>

                        <div className="kanban-card-category">
                          <Icon name="folder" size={14} />
                          <span>{t.category}</span>
                        </div>

                        <div className="kanban-card-people">
                          <div className="kanban-person" title="Người tạo yêu cầu">
                            <Avatar name={t.createdBy} className="avatar-xs" />
                            <div>
                              <small>Người tạo</small>
                              <strong>{t.createdBy}</strong>
                            </div>
                          </div>
                          <div className="kanban-person" title="Nhân viên xử lý">
                            <Avatar
                              name={t.assignedTo || "IT"}
                              className="avatar-xs staff-avatar"
                            />
                            <div>
                              <small>Người xử lý</small>
                              <strong className={!t.assignedTo ? "muted" : ""}>
                                {t.assignedTo || "Chưa phân công"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="kanban-card-dates">
                          <div>
                            <Icon name="clock" size={13} />
                            <span>Tạo: {fmt(t.createdAt)}</span>
                          </div>
                          {t.dueDate && (
                            <div className={overdue ? "due-overdue" : ""}>
                              <Icon
                                name={overdue ? "alert" : "clock"}
                                size={13}
                              />
                              <span>Hạn: {fmt(t.dueDate)}</span>
                            </div>
                          )}
                        </div>

                        {moves.length > 0 && (
                          <div
                            className="kanban-card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {moves.map((m) => (
                              <button
                                key={m.to}
                                type="button"
                                className={`btn btn-small ${
                                  m.to === "Cancelled"
                                    ? "btn-secondary"
                                    : "btn-primary"
                                }`}
                                disabled={Boolean(busyTicketId)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerTransition(t, m.to);
                                }}
                              >
                                {isUpdating ? "Đang lưu…" : m.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {resolveModal && (
        <div
          className="kanban-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-modal-title"
          onClick={() => {
            if (!busyTicketId) setResolveModal(null);
          }}
        >
          <div
            className="panel kanban-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kanban-modal-header">
              <div>
                <span className="eyebrow">{resolveModal.ticket.code}</span>
                <h3 id="resolve-modal-title">Hoàn tất xử lý yêu cầu</h3>
              </div>
              <button
                type="button"
                className="top-icon"
                aria-label="Đóng hộp thoại"
                disabled={Boolean(busyTicketId)}
                onClick={() => setResolveModal(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="kanban-modal-desc">
              Chuyển trạng thái ticket{" "}
              <strong>{resolveModal.ticket.title}</strong> sang{" "}
              <StatusBadge s={resolveModal.targetStatus} />. Vui lòng nhập ghi
              chú kết quả xử lý.
            </p>
            <Err msg={modalErr || actionErr} />
            <form onSubmit={submitResolveModal}>
              <label className="form-label">
                Ghi chú xử lý *
                <textarea
                  rows={4}
                  placeholder="Nhập nguyên nhân và kết quả khắc phục sự cố…"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  disabled={Boolean(busyTicketId)}
                  autoFocus
                  required
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={Boolean(busyTicketId)}
                  onClick={() => setResolveModal(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={Boolean(busyTicketId) || !resolveNote.trim()}
                >
                  <Icon name="check" size={16} />
                  {busyTicketId ? "Đang cập nhật…" : "Xác nhận hoàn tất"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Kanban riêng cho từng Ticket tại trang /tickets/{id} (Progress View).
 * Tái sử dụng quy tắc chuyển trạng thái getAllowedTransitions và dữ liệu thực từ GET /api/tickets/{id}/history.
 */
export function TicketProgressKanban({
  ticket,
  history = [],
  user,
  note = "",
  onNoteChange,
  onChangeStatus,
  busy = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [pendingResolve, setPendingResolve] = useState(false);
  const [localHintErr, setLocalHintErr] = useState("");

  useEffect(() => {
    setIsDragging(false);
    setDragOverCol(null);
    setPendingResolve(false);
    setLocalHintErr("");
  }, [ticket?.id, ticket?.status]);

  if (!ticket) return null;

  const allowedMoves = getAllowedTransitions(ticket, user);
  const allowedMoveMap = new Map(allowedMoves.map((m) => [m.to, m]));
  const canDrag = allowedMoves.length > 0 && !busy;
  const overdue = isTicketOverdue(ticket);

  // Xác định các trạng thái đã đi qua dựa hoàn toàn trên lịch sử thực tế từ API.
  const visitedSet = new Set(["Open", ticket.status]);
  history.forEach((h) => {
    if (h?.oldStatus) visitedSet.add(h.oldStatus);
    if (h?.newStatus) visitedSet.add(h.newStatus);
  });

  // Gom các bản ghi lịch sử theo trạng thái đích (newStatus) đúng thứ tự thời gian API trả về.
  const historyByTarget = KANBAN_COLUMNS.reduce((acc, s) => {
    acc[s] = [];
    return acc;
  }, {});
  history.forEach((h) => {
    if (h?.newStatus && historyByTarget[h.newStatus]) {
      historyByTarget[h.newStatus].push(h);
    }
  });

  const handleTransitionRequest = (targetStatus) => {
    if (busy || !targetStatus || targetStatus === ticket.status) return;
    setLocalHintErr("");
    const move = allowedMoveMap.get(targetStatus);
    if (!move) {
      setLocalHintErr(
        `Không thể chuyển từ "${STATUS_LABEL[ticket.status] || ticket.status}" sang "${STATUS_LABEL[targetStatus] || targetStatus}" theo quy trình và phân quyền hiện tại.`,
      );
      return;
    }
    if (targetStatus === "Resolved" && !note.trim()) {
      setPendingResolve(true);
      setLocalHintErr(
        "Vui lòng nhập ghi chú xử lý trước khi hoàn tất yêu cầu (Resolved).",
      );
      return;
    }
    setPendingResolve(false);
    onChangeStatus(targetStatus);
  };

  const handleDragStart = (e) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    setLocalHintErr("");
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(ticket.id));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverCol(null);
  };

  const handleDragOver = (e, status) => {
    if (!isDragging || status === ticket.status) return;
    if (allowedMoveMap.has(status)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverCol !== status) setDragOverCol(status);
    }
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setIsDragging(false);
    setDragOverCol(null);
    if (status === ticket.status) return;
    handleTransitionRequest(status);
  };

  const renderActiveCard = () => (
    <article
      className={[
        "kanban-card",
        "progress-active-card",
        canDrag ? "is-draggable" : "",
        isDragging ? "is-dragging" : "",
        busy ? "is-updating" : "",
        overdue ? "is-overdue" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-label={`Thẻ hiện tại ${ticket.code}`}
    >
      <div className="kanban-card-top">
        <span className="ticket-code">{ticket.code}</span>
        <div className="kanban-card-badges">
          {overdue && (
            <span className="badge badge-overdue">
              <Icon name="alert" size={13} />
              Quá hạn
            </span>
          )}
          <PriorityBadge p={ticket.priority} />
        </div>
      </div>

      <strong className="kanban-card-title">{ticket.title}</strong>

      <div className="kanban-card-category">
        <Icon name="folder" size={14} />
        <span>{ticket.category}</span>
      </div>

      <div className="kanban-card-people">
        <div className="kanban-person">
          <Avatar name={ticket.createdBy} className="avatar-xs" />
          <div>
            <small>Người tạo</small>
            <strong>{ticket.createdBy}</strong>
          </div>
        </div>
        <div className="kanban-person">
          <Avatar
            name={ticket.assignedTo || "IT"}
            className="avatar-xs staff-avatar"
          />
          <div>
            <small>Người xử lý</small>
            <strong className={!ticket.assignedTo ? "muted" : ""}>
              {ticket.assignedTo || "Chưa phân công"}
            </strong>
          </div>
        </div>
      </div>

      <div className="kanban-card-dates">
        <div>
          <Icon name="clock" size={13} />
          <span>Tạo: {fmt(ticket.createdAt)}</span>
        </div>
        {ticket.dueDate && (
          <div className={overdue ? "due-overdue" : ""}>
            <Icon name={overdue ? "alert" : "clock"} size={13} />
            <span>Hạn: {fmt(ticket.dueDate)}</span>
          </div>
        )}
        {ticket.resolvedAt && (
          <div>
            <Icon name="check" size={13} />
            <span>Giải quyết: {fmt(ticket.resolvedAt)}</span>
          </div>
        )}
        {ticket.closedAt && (
          <div>
            <Icon name="check" size={13} />
            <span>Đóng: {fmt(ticket.closedAt)}</span>
          </div>
        )}
      </div>

      {allowedMoves.length > 0 && (
        <div className="kanban-card-actions">
          {allowedMoves.map((m) => (
            <button
              key={m.to}
              type="button"
              className={`btn btn-small ${
                m.to === "Cancelled" ? "btn-secondary" : "btn-primary"
              }`}
              disabled={busy}
              onClick={() => handleTransitionRequest(m.to)}
            >
              {busy ? "Đang lưu…" : m.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );

  const renderHistoryLogs = (status) => {
    const entries = historyByTarget[status] || [];
    const isInitialOpen = status === "Open";

    return (
      <div className="progress-history-list">
        {isInitialOpen && (
          <div className="progress-history-item is-creation">
            <div className="progress-history-head">
              <strong>Khởi tạo yêu cầu</strong>
              <span>{fmt(ticket.createdAt)}</span>
            </div>
            <div className="progress-history-actor">
              Người tạo: <strong>{ticket.createdBy}</strong>
            </div>
          </div>
        )}

        {entries.map((h, idx) => (
          <div className="progress-history-item" key={idx}>
            <div className="progress-history-head">
              <strong>
                {STATUS_LABEL[h.oldStatus] || h.oldStatus} →{" "}
                {STATUS_LABEL[h.newStatus] || h.newStatus}
              </strong>
              <span>{fmt(h.changedAt)}</span>
            </div>
            <div className="progress-history-actor">
              Thực hiện: <strong>{h.changedBy}</strong>
            </div>
            {h.note && <p className="progress-history-note">{h.note}</p>}
          </div>
        ))}
      </div>
    );
  };

  const renderColumn = (status, isCancelledBranch = false) => {
    const isCurrent = ticket.status === status;
    const isVisited = visitedSet.has(status);
    const move = allowedMoveMap.get(status);
    const isAllowedTarget = Boolean(move);
    const isDragOver = dragOverCol === status && isAllowedTarget;
    const entries = historyByTarget[status] || [];
    const hasHistoryInfo = status === "Open" || entries.length > 0;

    return (
      <section
        key={status}
        className={[
          "progress-column",
          `progress-col-${status}`,
          isCancelledBranch ? "is-cancelled-branch" : "",
          isCurrent ? "is-current" : "",
          !isCurrent && isVisited ? "is-visited" : "",
          !isCurrent && !isVisited ? "is-unvisited" : "",
          isAllowedTarget ? "is-next-allowed" : "",
          isDragging && !isCurrent && !isAllowedTarget
            ? "is-drop-disabled"
            : "",
          isDragOver ? "is-drag-over" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          if (dragOverCol === status) setDragOverCol(null);
        }}
        onDrop={(e) => handleDrop(e, status)}
        aria-label={`Trạng thái ${STATUS_LABEL[status] || status}`}
      >
        <header className="progress-col-header">
          <div className="kanban-column-title">
            <span
              className="kanban-status-dot"
              style={{ background: STATUS_COLOR[status] || "#a5afbf" }}
            />
            <StatusBadge s={status} />
          </div>
          {isCurrent ? (
            <span className="progress-state-tag tag-current">Hiện tại</span>
          ) : isVisited ? (
            <span className="progress-state-tag tag-visited">
              <Icon name="check" size={12} />
              Đã đi qua
            </span>
          ) : isAllowedTarget ? (
            <span className="progress-state-tag tag-next">Có thể chuyển</span>
          ) : (
            <span className="progress-state-tag tag-pending">Chưa qua</span>
          )}
        </header>

        <div className="progress-col-body">
          {isCurrent && renderActiveCard()}

          {!isCurrent && isAllowedTarget && (
            <div className="progress-dropzone">
              <p>
                {isDragging
                  ? `Thả thẻ vào đây để "${move.label}"`
                  : `Bước tiếp theo hợp lệ: ${move.label}`}
              </p>
              <button
                type="button"
                className={`btn btn-small ${
                  status === "Cancelled" ? "btn-secondary" : "btn-primary"
                }`}
                disabled={busy}
                onClick={() => handleTransitionRequest(status)}
              >
                {busy ? "Đang lưu…" : move.label}
              </button>
            </div>
          )}

          {hasHistoryInfo ? (
            renderHistoryLogs(status)
          ) : (
            !isCurrent &&
            !isAllowedTarget && (
              <div className="progress-empty-step">
                <span>Chưa có dữ liệu lịch sử ở bước này.</span>
              </div>
            )
          )}
        </div>
      </section>
    );
  };

  return (
    <section className="panel detail-section progress-kanban-section">
      <div className="detail-section-heading">
        <div>
          <h3>Tiến độ xử lý Kanban</h3>
          <p className="muted">
            Theo dõi luồng trạng thái, các mốc đã đi qua và bước chuyển tiếp hợp
            lệ của {ticket.code}.
          </p>
        </div>
        {canDrag && (
          <span className="progress-drag-tip">
            Kéo thả thẻ hiện tại hoặc nhấn nút để chuyển trạng thái
          </span>
        )}
      </div>

      {localHintErr && <Err msg={localHintErr} />}

      {allowedMoveMap.has("Resolved") && (pendingResolve || !note.trim()) && (
        <div className="progress-note-box">
          <label className="form-label">
            Ghi chú xử lý (bắt buộc khi chuyển sang Đã giải quyết) *
            <textarea
              rows={3}
              placeholder="Nhập kết quả xử lý sự cố trước khi chuyển sang Đã giải quyết…"
              value={note}
              disabled={busy}
              onChange={(e) => {
                onNoteChange?.(e.target.value);
                if (e.target.value.trim()) setLocalHintErr("");
              }}
            />
          </label>
          {pendingResolve && (
            <div className="progress-note-actions">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={busy}
                onClick={() => {
                  setPendingResolve(false);
                  setLocalHintErr("");
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={busy || !note.trim()}
                onClick={() => handleTransitionRequest("Resolved")}
              >
                <Icon name="check" size={15} />
                {busy ? "Đang lưu…" : "Xác nhận Đã xử lý xong"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="progress-flow-label">
        <span>LUỒNG XỬ LÝ CHÍNH (OPEN → IN PROGRESS ↔ PENDING → RESOLVED → CLOSED)</span>
      </div>
      <div
        className="progress-kanban-scroll"
        role="region"
        aria-label="Luồng xử lý chính của Ticket"
      >
        <div className="progress-kanban-track">
          {MAIN_PROGRESS_COLUMNS.map((status) => renderColumn(status, false))}
        </div>
      </div>

      <div
        className={[
          "progress-cancelled-wrapper",
          ticket.status === CANCELLED_COLUMN ? "is-cancelled-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="progress-flow-label is-branch-label">
          <span>
            NHÁNH KẾT THÚC RIÊNG (CANCELLED —{" "}
            {ticket.status === CANCELLED_COLUMN
              ? "TICKET ĐÃ HỦY"
              : "HỦY YÊU CẦU"}
            )
          </span>
        </div>
        <div className="progress-cancelled-track">
          {renderColumn(CANCELLED_COLUMN, true)}
        </div>
      </div>
    </section>
  );
}

