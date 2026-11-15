import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import KanbanBoard from "../KanbanBoard";
import { Err, Icon, PageHeader, TicketTable, STATUS_LABEL } from "../ui";

const VIEW_STORAGE_KEY = "tickets_view_mode";
const KANBAN_PAGE_SIZE = 50;

export default function Tickets() {
  const { user } = useAuth();
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "kanban" ? "kanban" : "list";
  });
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  const [kanban, setKanban] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: KANBAN_PAGE_SIZE,
  });
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState({
    search: "",
    status: "",
    categoryId: "",
    page: 1,
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const changeView = (nextView) => {
    setView(nextView);
    localStorage.setItem(VIEW_STORAGE_KEY, nextView);
  };

  useEffect(() => {
    api("/categories")
      .then((v) => setCats(v || []))
      .catch(() => {});
  }, []);

  // Tải dữ liệu cho List View (giữ nguyên cơ chế phân trang mặc định pageSize = 10).
  useEffect(() => {
    if (view !== "list") return;
    let active = true;
    setLoading(true);
    setErr("");
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== "" && p.set(k, v));
    // Bỏ qua phản hồi cũ khi người dùng thay đổi bộ lọc liên tục.
    api("/tickets?" + p)
      .then((v) => {
        if (active && v) setData(v);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q, view]);

  // Tải dữ liệu cho Kanban View (pageSize = 50, hỗ trợ tải thêm nếu total > 50).
  useEffect(() => {
    if (view !== "kanban") return;
    let active = true;
    setKanbanLoading(true);
    setErr("");
    const p = new URLSearchParams();
    if (q.search !== "") p.set("search", q.search);
    if (q.status !== "") p.set("status", q.status);
    if (q.categoryId !== "") p.set("categoryId", q.categoryId);
    p.set("page", "1");
    p.set("pageSize", String(KANBAN_PAGE_SIZE));

    api("/tickets?" + p)
      .then((v) => {
        if (active && v) {
          setKanban({
            items: v.items || [],
            total: v.total || 0,
            page: v.page || 1,
            pageSize: v.pageSize || KANBAN_PAGE_SIZE,
          });
        }
      })
      .catch((e) => {
        if (active) setErr(e.message);
      })
      .finally(() => {
        if (active) setKanbanLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q.search, q.status, q.categoryId, view]);

  const buildKanbanParams = (pageNum) => {
    const p = new URLSearchParams();
    if (q.search !== "") p.set("search", q.search);
    if (q.status !== "") p.set("status", q.status);
    if (q.categoryId !== "") p.set("categoryId", q.categoryId);
    p.set("page", String(pageNum));
    p.set("pageSize", String(KANBAN_PAGE_SIZE));
    return p;
  };

  const mergeUniqueTickets = (existing, incoming) => {
    const map = new Map(existing.map((item) => [item.id, item]));
    (incoming || []).forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  };

  const loadMoreKanban = async () => {
    if (loadingMore || kanban.items.length >= kanban.total) return;
    setLoadingMore(true);
    setErr("");
    try {
      const nextPage = kanban.page + 1;
      const v = await api("/tickets?" + buildKanbanParams(nextPage));
      if (v) {
        setKanban((cur) => ({
          items: mergeUniqueTickets(cur.items, v.items),
          total: v.total ?? cur.total,
          page: nextPage,
          pageSize: v.pageSize || KANBAN_PAGE_SIZE,
        }));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadAllKanban = async () => {
    if (loadingMore || kanban.items.length >= kanban.total) return;
    setLoadingMore(true);
    setErr("");
    try {
      const totalPages = Math.ceil(kanban.total / kanban.pageSize);
      let accItems = [...kanban.items];
      let currentPage = kanban.page;
      let latestTotal = kanban.total;

      while (currentPage < totalPages && accItems.length < latestTotal) {
        currentPage += 1;
        const v = await api("/tickets?" + buildKanbanParams(currentPage));
        if (!v || !v.items?.length) break;
        accItems = mergeUniqueTickets(accItems, v.items);
        latestTotal = v.total ?? latestTotal;
      }

      setKanban((cur) => ({
        ...cur,
        items: accItems,
        total: latestTotal,
        page: currentPage,
      }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleStatusChange = async (ticketId, targetStatus, note) => {
    const updated = await api(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      body: { status: targetStatus, note: note || null },
    });
    if (updated) {
      setKanban((cur) => {
        // Nếu đang lọc theo 1 status cố định mà ticket đã sang status khác, loại khỏi kết quả lọc hiện tại.
        if (q.status && updated.status !== q.status) {
          return {
            ...cur,
            items: cur.items.filter((item) => item.id !== updated.id),
            total: Math.max(0, cur.total - 1),
          };
        }
        return {
          ...cur,
          items: cur.items.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        };
      });
    }
    return updated;
  };

  const upd = (k) => (e) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const isKanban = view === "kanban";
  const activeLoading = isKanban ? kanbanLoading : loading;
  const activeTotal = isKanban ? kanban.total : data.total;
  const hasMoreKanban = kanban.items.length < kanban.total;

  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN LÀM VIỆC / TICKET"
        title={user.role === "Staff" ? "Ticket được giao" : "Quản lý Ticket"}
        description="Theo dõi, tìm kiếm và quản lý các yêu cầu hỗ trợ kỹ thuật."
        action={
          user.role !== "Staff" && (
            <Link className="btn btn-primary" to="/tickets/new">
              <Icon name="plus" />
              Tạo yêu cầu mới
            </Link>
          )
        }
      />
      <section className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Tìm ticket"
              placeholder="Tìm theo tiêu đề hoặc mã ticket…"
              value={q.search}
              onChange={upd("search")}
            />
          </div>
          <select
            aria-label="Lọc trạng thái"
            value={q.status}
            onChange={upd("status")}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc danh mục"
            value={q.categoryId}
            onChange={upd("categoryId")}
          >
            <option value="">Tất cả danh mục</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-toolbar">
          <span>
            <Icon name="ticket" size={15} />
            {activeLoading ? "Đang tải…" : `${activeTotal} yêu cầu`}
          </span>
          <div className="toolbar-actions">
            {(q.search || q.status || q.categoryId) && (
              <button
                className="text-button"
                onClick={() =>
                  setQ({ search: "", status: "", categoryId: "", page: 1 })
                }
              >
                Xóa bộ lọc
              </button>
            )}
            <div
              className="tab-pills"
              role="tablist"
              aria-label="Chế độ hiển thị"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isKanban}
                className={!isKanban ? "selected" : ""}
                onClick={() => changeView("list")}
              >
                Danh sách
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isKanban}
                className={isKanban ? "selected" : ""}
                onClick={() => changeView("kanban")}
              >
                Kanban
              </button>
            </div>
          </div>
        </div>
        {err ? (
          <div className="panel-body">
            <Err msg={err} />
          </div>
        ) : isKanban ? (
          <KanbanBoard
            items={kanban.items}
            total={kanban.total}
            loading={kanbanLoading}
            loadingMore={loadingMore}
            hasMore={hasMoreKanban}
            onLoadMore={loadMoreKanban}
            onLoadAll={loadAllKanban}
            onStatusChange={handleStatusChange}
            user={user}
          />
        ) : (
          <>
            <TicketTable items={data.items} loading={loading} />
            <div className="pagination">
              <span>
                Trang {data.page} / {pages}
              </span>
              <div>
                <button
                  className="btn btn-secondary btn-small"
                  disabled={loading || q.page <= 1}
                  onClick={() => setQ({ ...q, page: q.page - 1 })}
                >
                  ‹ Trước
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  disabled={loading || q.page >= pages}
                  onClick={() => setQ({ ...q, page: q.page + 1 })}
                >
                  Sau ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
