import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Err, Icon, PageHeader, TicketTable, STATUS_LABEL } from "../ui";

export default function Tickets() {
  const { user } = useAuth();
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
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
  useEffect(() => {
    api("/categories")
      .then((v) => setCats(v || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
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
  }, [q]);
  const upd = (k) => (e) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
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
            {loading ? "Đang tải…" : `${data.total} yêu cầu`}
          </span>
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
        </div>
        {err ? (
          <div className="panel-body">
            <Err msg={err} />
          </div>
        ) : (
          <TicketTable items={data.items} loading={loading} />
        )}
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
      </section>
    </>
  );
}
