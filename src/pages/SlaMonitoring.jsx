import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import SlaDashboardSection from "../SlaDashboardSection";
import { Icon, PageHeader } from "../ui";

function ymd(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function rangeOf(preset) {
  const end = new Date();
  const start = new Date();
  if (preset === "week") {
    const monday = (end.getDay() + 6) % 7;
    start.setDate(end.getDate() - monday);
  } else if (preset === "month") {
    start.setDate(1);
  }
  return { from: ymd(start), to: ymd(end) };
}

export default function SlaMonitoring() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });

  const applyRange = (nextFrom = from, nextTo = to) => {
    let start = nextFrom;
    let end = nextTo;
    if (start && end && start > end) [start, end] = [end, start];
    setFrom(start);
    setTo(end);
    setApplied({ from: start, to: end });
  };

  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN LÀM VIỆC / SLA MONITORING"
        title={isAdmin ? "Giám sát SLA & Hiệu suất" : "Giám sát SLA"}
        description={
          isAdmin
            ? "Theo dõi thời gian xử lý thực tế theo chính sách SLA 24 giờ, phát hiện Ticket quá hạn và đánh giá hiệu suất từng Support Staff."
            : "Theo dõi tiến độ thời gian xử lý 24 giờ cho các Ticket được giao cho bạn và cảnh báo sắp quá hạn."
        }
        action={
          <Link className="btn btn-secondary" to="/tickets?view=kanban">
            <Icon name="activity" />
            Mở Bảng Kanban
          </Link>
        }
      />

      <div className="range-bar">
        <div className="range-presets">
          {[
            ["all", "Toàn bộ thời gian"],
            ["day", "Hôm nay"],
            ["week", "Tuần này"],
            ["month", "Tháng này"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-small ${preset === key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setPreset(key);
                if (key === "all") {
                  applyRange("", "");
                } else {
                  const r = rangeOf(key);
                  applyRange(r.from, r.to);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="range-inputs">
          <label className="range-date-field">
            <span>Từ</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("");
                setFrom(e.target.value);
              }}
            />
          </label>
          <span className="range-sep">→</span>
          <label className="range-date-field">
            <span>Đến</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("");
                setTo(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-small range-apply-btn"
            onClick={() => applyRange(from, to)}
          >
            Áp dụng
          </button>
        </div>
      </div>

      <SlaDashboardSection
        user={user}
        from={applied.from}
        to={applied.to}
        mode="full"
      />
    </>
  );
}
