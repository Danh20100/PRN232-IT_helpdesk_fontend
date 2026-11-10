import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Err, Icon } from "../ui";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [register, setRegister] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
  });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      const body = register ? f : { email: f.email, password: f.password };
      login(
        await api(register ? "/auth/register" : "/auth/login", {
          method: "POST",
          body,
        }),
      );
      nav("/");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <div className="auth-left">
        <div className="auth-brand">
          <span className="brand-icon">
            <Icon name="headset" size={24} />
          </span>
          <strong>
            HelpDesk<span className="brand-dot">.</span>
          </strong>
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <div className="illustration-circle circle-one" />
          <div className="illustration-circle circle-two" />
          <div className="floating-ticket">
            <div className="floating-top">
              <Icon name="ticket" size={23} />
              <span>Yêu cầu hỗ trợ IT</span>
              <Icon name="check" size={20} />
            </div>
            <div className="floating-line wide" />
            <div className="floating-line" />
            <div className="floating-pills">
              <span>Đang xử lý</span>
              <span>Ưu tiên cao</span>
            </div>
          </div>
          <div className="floating-users">
            <Icon name="users" size={20} />
            Đội ngũ IT sẵn sàng hỗ trợ
          </div>
        </div>
        <div className="auth-pitch">
          <div className="auth-kicker">GIẢI PHÁP HỖ TRỢ IT THÔNG MINH</div>
          <h2>
            Mọi vấn đề kỹ thuật.
            <br />
            Một nơi giải quyết.
          </h2>
          <p>
            Gửi yêu cầu, theo dõi tiến độ và kết nối với đội ngũ kỹ thuật nhanh
            chóng, minh bạch hơn.
          </p>
          <div className="auth-features">
            <span>
              <Icon name="check" size={16} />
              Quản lý tập trung
            </span>
            <span>
              <Icon name="check" size={16} />
              Theo dõi tiến độ
            </span>
          </div>
        </div>
        <div className="auth-copyright">
          © 2026 IT Helpdesk. All rights reserved.
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <Icon name="headset" size={24} />
            HelpDesk.
          </div>
          <div className="auth-welcome">
            <span className="auth-mini-label">
              {register ? "BẮT ĐẦU NGAY" : "CHÀO MỪNG TRỞ LẠI"}
            </span>
            <h1>{register ? "Tạo tài khoản" : "Đăng nhập"}</h1>
            <p>
              {register
                ? "Điền thông tin để bắt đầu sử dụng hệ thống hỗ trợ IT."
                : "Vui lòng nhập thông tin để truy cập vào hệ thống Helpdesk."}
            </p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {register && (
              <label>
                Họ và tên
                <div className="input-icon">
                  <Icon name="user" size={18} />
                  <input
                    placeholder="Nguyễn Văn A"
                    autoComplete="name"
                    value={f.fullName}
                    onChange={set("fullName")}
                    required
                  />
                </div>
              </label>
            )}
            <label>
              Email
              <div className="input-icon">
                <Icon name="mail" size={18} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={f.email}
                  onChange={set("email")}
                  required
                />
              </div>
            </label>
            <label>
              Mật khẩu
              <div className="input-icon">
                <Icon name="lock" size={18} />
                <input
                  type={show ? "text" : "password"}
                  placeholder="Nhập mật khẩu của bạn"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={f.password}
                  onChange={set("password")}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </label>
            {register && (
              <label>
                Số điện thoại <span className="muted">(không bắt buộc)</span>
                <div className="input-icon">
                  <Icon name="user" size={18} />
                  <input
                    type="tel"
                    placeholder="Số điện thoại của bạn"
                    autoComplete="tel"
                    value={f.phoneNumber}
                    onChange={set("phoneNumber")}
                  />
                </div>
              </label>
            )}
            <Err msg={err} />
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="auth-switch">
            {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setErr("");
              }}
            >
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
