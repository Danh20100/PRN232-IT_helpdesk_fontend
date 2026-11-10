import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import TicketForm from "../TicketForm";
import { Err, Icon, PageHeader } from "../ui";

export default function NewTicket() {
  const nav = useNavigate();
  const { user } = useAuth();
  const canAssign = user.role === "Admin";
  const [staff, setStaff] = useState(null);
  const [staffId, setStaffId] = useState("");
  const [staffError, setStaffError] = useState("");

  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    api("/users/support-staff")
      .then((items) => {
        if (active) setStaff(items || []);
      })
      .catch((e) => {
        if (active) setStaffError(e.message);
      });
    return () => {
      active = false;
    };
  }, [canAssign]);

  const save = async (fields) => {
    const ticket = await api("/tickets", {
      method: "POST",
      body: canAssign && staffId ? { ...fields, staffId: Number(staffId) } : fields,
    });
    if (ticket) nav(`/tickets/${ticket.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="TICKET / TẠO YÊU CẦU"
        title="Tạo yêu cầu hỗ trợ"
        description="Cho chúng tôi biết vấn đề bạn đang gặp phải. Đội ngũ IT sẽ hỗ trợ bạn."
      />
      <div className="form-grid">
        <TicketForm
          onSave={save}
          cancel={() => (
            <Link className="btn btn-secondary" to="/tickets">
              Hủy bỏ
            </Link>
          )}
        >
          {(busy) => canAssign && (
            <>
              <Err msg={staffError} />
              <label className="form-label">
                Nhân viên xử lý
                <select
                  value={staffId}
                  disabled={busy || !staff?.length}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">
                    {staff || staffError ? "Chưa phân công" : "Đang tải nhân viên…"}
                  </option>
                  {staff?.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </TicketForm>
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
