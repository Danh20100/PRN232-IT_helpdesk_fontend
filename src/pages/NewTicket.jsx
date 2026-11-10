import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Err, Icon, PageHeader, PRIORITY_LABEL } from "../ui";

export default function NewTicket() {
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    description: "",
    categoryId: "",
    priority: "Medium",
  });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    api("/categories")
      .then((v) => setCats(v || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      const t = await api("/tickets", {
        method: "POST",
        body: { ...f, categoryId: +f.categoryId },
      });
      if (t) nav(`/tickets/${t.id}`);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="TICKET / TẠO YÊU CẦU"
        title="Tạo yêu cầu hỗ trợ"
        description="Cho chúng tôi biết vấn đề bạn đang gặp phải. Đội ngũ IT sẽ hỗ trợ bạn."
      />
      <div className="form-grid">
        <form className="panel ticket-form" onSubmit={submit}>
          <div className="section-heading">
            <h3>
              <Icon name="ticket" />
              Thông tin yêu cầu
            </h3>
            <p>Điền đầy đủ thông tin để yêu cầu được xử lý nhanh chóng.</p>
          </div>
          <Err msg={err} />
          <label className="form-label">
            Tiêu đề yêu cầu *
            <input
              placeholder="Ví dụ: Không thể kết nối Wi-Fi văn phòng"
              value={f.title}
              onChange={set("title")}
              required
            />
          </label>
          <div className="two-cols">
            <label className="form-label">
              Danh mục sự cố *
              <select
                value={f.categoryId}
                onChange={set("categoryId")}
                required
                disabled={loading}
              >
                <option value="">
                  {loading ? "Đang tải danh mục…" : "Chọn danh mục"}
                </option>
                {cats
                  .filter((c) => c.isActive !== false)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-label">
              Mức độ ưu tiên
              <select value={f.priority} onChange={set("priority")}>
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
              rows="8"
              placeholder="Mô tả sự cố, thời điểm xảy ra và những bước bạn đã thử…"
              value={f.description}
              onChange={set("description")}
              required
            />
          </label>
          <div className="form-actions">
            <Link className="btn btn-secondary" to="/tickets">
              Hủy bỏ
            </Link>
            <button
              className="btn btn-primary"
              disabled={
                busy || loading || !cats.some((c) => c.isActive !== false)
              }
            >
              <Icon name="plus" size={17} />
              {busy ? "Đang gửi…" : "Gửi yêu cầu"}
            </button>
          </div>
        </form>
        <aside className="panel info-panel">
          <div className="info-round">
            <Icon name="help" size={24} />
          </div>
          <h3>Để được hỗ trợ nhanh hơn</h3>
          <p>
            Một vài thông tin hữu ích giúp nhân viên IT hiểu rõ vấn đề của bạn.
          </p>
          <ul>
            <li>Đặt tiêu đề ngắn gọn, rõ ràng.</li>
            <li>Chọn đúng danh mục sự cố.</li>
            <li>Mô tả thông báo lỗi và cách tái hiện.</li>
            <li>Chọn mức ưu tiên theo mức độ ảnh hưởng.</li>
          </ul>
          <div className="info-note">
            Sau khi gửi, bạn có thể theo dõi tiến độ và trao đổi trực tiếp với
            nhân viên IT trong chi tiết ticket.
          </div>
        </aside>
      </div>
    </>
  );
}
