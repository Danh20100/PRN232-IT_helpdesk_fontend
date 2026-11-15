import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Err, PageHeader, ROLE_LABEL } from "../ui";

export default function Profile() {
  const { updateUser } = useAuth();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState({ fullName: "", phoneNumber: "" });
  const [password, setPassword] = useState({ oldPassword: "", newPassword: "" });
  const [err, setErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/users/me")
      .then((u) => {
        if (!u) return;
        setMe(u);
        setProfile({ fullName: u.fullName || "", phoneNumber: u.phoneNumber || "" });
      })
      .catch((e) => setErr(e.message));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setSaved("");
    try {
      const u = await api("/users/me", {
        method: "PUT",
        body: {
          fullName: profile.fullName.trim(),
          phoneNumber: profile.phoneNumber.trim() || null,
        },
      });
      if (u) {
        setMe(u);
        updateUser({ fullName: u.fullName });
        setSaved("Đã lưu hồ sơ.");
      }
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setPwErr("");
    setSaved("");
    try {
      await api("/users/change-password", {
        method: "PUT",
        body: password,
      });
      setPassword({ oldPassword: "", newPassword: "" });
      setSaved("Đã đổi mật khẩu.");
    } catch (ex) {
      setPwErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="TÀI KHOẢN"
        title="Hồ sơ"
        description="Xem email, cập nhật tên và số điện thoại, hoặc đổi mật khẩu."
      />
      <div className="form-grid">
        <form className="panel ticket-form" onSubmit={saveProfile}>
          <div className="section-heading">
            <h3>Thông tin cá nhân</h3>
            <p>{me ? ROLE_LABEL[me.role] : "Đang tải…"}</p>
          </div>
          <Err msg={err} />
          <label className="form-label">
            Email
            <input value={me?.email || ""} disabled />
          </label>
          <label className="form-label">
            Họ và tên
            <input
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              required
              maxLength={100}
            />
          </label>
          <label className="form-label">
            Số điện thoại
            <input
              value={profile.phoneNumber}
              onChange={(e) =>
                setProfile({ ...profile, phoneNumber: e.target.value })
              }
            />
          </label>
          <div className="form-actions">
            {saved && <span className="muted">{saved}</span>}
            <button className="btn btn-primary" disabled={busy || !me}>
              Lưu hồ sơ
            </button>
          </div>
        </form>
        <form className="panel ticket-form" onSubmit={savePassword}>
          <div className="section-heading">
            <h3>Đổi mật khẩu</h3>
            <p>Mật khẩu mới tối thiểu 6 ký tự.</p>
          </div>
          <Err msg={pwErr} />
          <label className="form-label">
            Mật khẩu cũ
            <input
              type="password"
              value={password.oldPassword}
              onChange={(e) =>
                setPassword({ ...password, oldPassword: e.target.value })
              }
              required
            />
          </label>
          <label className="form-label">
            Mật khẩu mới
            <input
              type="password"
              value={password.newPassword}
              onChange={(e) =>
                setPassword({ ...password, newPassword: e.target.value })
              }
              required
              minLength={6}
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              Đổi mật khẩu
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
