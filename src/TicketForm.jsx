import { useEffect, useState } from "react";
import { api } from "./api";
import { Err, Icon, PRIORITY_LABEL } from "./ui";

export default function TicketForm({ ticket, onSave, cancel, children }) {
  const [categories, setCategories] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    title: ticket?.title ?? "",
    description: ticket?.description ?? "",
    categoryId: ticket?.categoryId,
    priority: ticket?.priority ?? "Medium",
  });

  useEffect(() => {
    let active = true;
    api("/categories")
      .then((items) => {
        if (active) {
          setCategories((items || []).filter((c) => c.isActive !== false));
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  // Older API versions return the category name without its ID.
  const categoryId =
    fields.categoryId ?? categories?.find((c) => c.name === ticket?.category)?.id;
  const hasCategory = categories?.some((c) => c.id === Number(categoryId));
  const set = (key) => (e) => {
    const value = e.target.value;
    setFields((current) => ({ ...current, [key]: value }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy || !hasCategory) return;
    const title = fields.title.trim();
    const description = fields.description.trim();
    if (!title || !description) {
      setError("Vui lòng nhập tiêu đề và mô tả yêu cầu.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSave({
        title,
        description,
        categoryId: Number(categoryId),
        priority: fields.priority,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel ticket-form" onSubmit={submit}>
      <div className="section-heading">
        <h3>
          <Icon name="ticket" />
          {ticket ? "Chỉnh sửa thông tin yêu cầu" : "Thông tin yêu cầu"}
        </h3>
        {!ticket && <p>Điền đầy đủ thông tin để yêu cầu được xử lý nhanh chóng.</p>}
      </div>
      <Err msg={loadError || error} />
      <label className="form-label">
        Tiêu đề yêu cầu *
        <input
          placeholder="Ví dụ: Không thể kết nối Wi-Fi văn phòng"
          value={fields.title}
          onChange={set("title")}
          maxLength={200}
          disabled={busy}
          required
        />
      </label>
      <div className="two-cols">
        <label className="form-label">
          Danh mục sự cố *
          <select
            value={hasCategory ? categoryId : ""}
            onChange={set("categoryId")}
            disabled={busy || !categories?.length}
            required
          >
            <option value="">
              {loadError
                ? "Không tải được danh mục"
                : !categories
                  ? "Đang tải danh mục…"
                  : categories.length
                    ? "Chọn danh mục"
                    : "Không có danh mục đang hoạt động"}
            </option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Mức độ ưu tiên
          <select value={fields.priority} onChange={set("priority")} disabled={busy}>
            {Object.entries(PRIORITY_LABEL).map(([p, label]) => (
              <option value={p} key={p}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="form-label">
        Mô tả chi tiết *
        <textarea
          rows={ticket ? 5 : 8}
          placeholder="Mô tả sự cố, thời điểm xảy ra và những bước bạn đã thử…"
          value={fields.description}
          onChange={set("description")}
          disabled={busy}
          required
        />
      </label>
      {children?.(busy)}
      <div className="form-actions">
        {cancel(busy)}
        <button className="btn btn-primary" disabled={busy || !hasCategory}>
          <Icon name={ticket ? "check" : "plus"} size={17} />
          {busy ? "Đang lưu…" : ticket ? "Lưu thay đổi" : "Gửi yêu cầu"}
        </button>
      </div>
    </form>
  );
}
