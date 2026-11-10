import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Avatar,
  Empty,
  Err,
  Icon,
  Loading,
  PageHeader,
  ROLE_LABEL,
} from "../ui";

export default function Admin({ section = "users" }) {
  const [users, setUsers] = useState([]);
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const categories = section === "categories";
  const load = async () => {
    const [u, c] = await Promise.all([api("/users"), api("/categories")]);
    setUsers(u || []);
    setCats(c || []);
  };
  useEffect(() => {
    load()
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setErr("");
    setSearch("");
  }, [section]);
  const run = async (fn) => {
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveCategory = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      await api(editing ? `/categories/${editing.id}` : "/categories", {
        method: editing ? "PUT" : "POST",
        body: editing
          ? { name: name.trim(), description: editing.description }
          : { name: name.trim() },
      });
      setName("");
      setEditing(null);
    });
  };
  const shown = users.filter((u) =>
    `${u.fullName} ${u.email}`
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeader
        eyebrow={`QUẢN TRỊ / ${categories ? "DANH MỤC" : "NGƯỜI DÙNG"}`}
        title={categories ? "Danh mục sự cố" : "Quản lý người dùng"}
        description={
          categories
            ? "Tổ chức các nhóm sự cố và quản lý danh mục hỗ trợ."
            : "Quản lý tài khoản, vai trò và quyền truy cập hệ thống."
        }
      />
      <Err msg={err} />
      {loading ? (
        <Loading />
      ) : categories ? (
        <div className="category-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Danh sách danh mục</h3>
                <p>{cats.length} danh mục sự cố</p>
              </div>
              <Icon name="folder" />
            </div>
            <div className="category-list">
              {cats.map((c) => (
                <div className="category-row" key={c.id}>
                  <span className="category-symbol">
                    <Icon name="folder" size={17} />
                  </span>
                  <strong>{c.name}</strong>
                  <span
                    className={`status-text ${c.isActive ? "is-active" : "is-inactive"}`}
                  >
                    {c.isActive ? "Đang dùng" : "Đã tắt"}
                  </span>
                  <button
                    className="btn btn-secondary btn-small"
                    disabled={busy}
                    onClick={() => {
                      setEditing(c);
                      setName(c.name);
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api(`/categories/${c.id}/status`, {
                          method: "PATCH",
                          body: { isActive: !c.isActive },
                        }),
                      )
                    }
                  >
                    {c.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                  </button>
                </div>
              ))}
              {!cats.length && (
                <Empty
                  title="Chưa có danh mục"
                  description="Thêm danh mục đầu tiên cho hệ thống."
                />
              )}
            </div>
          </section>
          <section className="panel category-edit">
            <h3>{editing ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}</h3>
            <p>Phân loại yêu cầu để hỗ trợ hiệu quả hơn.</p>
            <form onSubmit={saveCategory}>
              <label className="form-label">
                Tên danh mục *
                <input
                  placeholder="Ví dụ: Phần cứng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary" disabled={busy}>
                {busy
                  ? "Đang lưu…"
                  : editing
                    ? "Lưu thay đổi"
                    : "Thêm danh mục"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setName("");
                  }}
                >
                  Hủy
                </button>
              )}
            </form>
          </section>
        </div>
      ) : (
        <section className="panel">
          <div className="filter-bar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                aria-label="Tìm người dùng"
                placeholder="Tìm theo họ tên hoặc email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-toolbar">
            <span>{shown.length} tài khoản</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={u.fullName} />
                        <strong>{u.fullName}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="assignment-select"
                        aria-label={`Vai trò của ${u.fullName}`}
                        disabled={busy}
                        value={u.role}
                        onChange={(e) =>
                          run(() =>
                            api(`/users/${u.id}/role`, {
                              method: "PATCH",
                              body: { role: e.target.value },
                            }),
                          )
                        }
                      >
                        {Object.entries(ROLE_LABEL).map(([r, label]) => (
                          <option key={r} value={r}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`status-text ${u.isActive ? "is-active" : "is-inactive"}`}
                      >
                        {u.isActive ? "● Hoạt động" : "● Đã khóa"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api(`/users/${u.id}/status`, {
                              method: "PATCH",
                              body: { isActive: !u.isActive },
                            }),
                          )
                        }
                      >
                        {u.isActive ? "Khóa tài khoản" : "Mở khóa"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan="5">
                      <Empty
                        title="Không tìm thấy tài khoản"
                        description="Thử tìm kiếm bằng tên hoặc email khác."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
