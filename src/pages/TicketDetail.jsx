import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, PriorityBadge, StatusBadge, fmt } from '../ui';

// Các nút chuyển trạng thái hiển thị cho user hiện tại (backend vẫn kiểm tra lại)
function actionsFor(t, me) {
  const staff = me.role === 'Staff' && t.assignedToId === me.userId;
  const owner = t.createdById === me.userId;
  const a = [];
  if (staff && t.status === 'Open') a.push(['InProgress', 'Bắt đầu xử lý']);
  if (staff && t.status === 'InProgress') a.push(['Pending', 'Chờ phản hồi'], ['Resolved', 'Đã xử lý xong']);
  if (staff && t.status === 'Pending') a.push(['InProgress', 'Tiếp tục xử lý']);
  if (owner && t.status === 'Resolved') a.push(['Closed', 'Xác nhận đã hết lỗi'], ['InProgress', 'Vẫn còn lỗi']);
  if (owner && t.status === 'Open') a.push(['Cancelled', 'Hủy yêu cầu']);
  return a;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [t, setT] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [staff, setStaff] = useState([]);
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [staffId, setStaffId] = useState('');
  const [due, setDue] = useState('');
  const [fb, setFb] = useState({ rating: 5, comment: '' });
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      setT(await api(`/tickets/${id}`));
      setComments(await api(`/tickets/${id}/comments`));
      setHistory(await api(`/tickets/${id}/history`));
      setFeedback(await api(`/tickets/${id}/feedback`).catch(() => null));
      if (user.role === 'Admin') setStaff(await api('/users/support-staff'));
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  const run = async (fn) => {
    setErr('');
    try { await fn(); await load(); } catch (e) { setErr(e.message); }
  };

  const changeStatus = (status) =>
    run(async () => { await api(`/tickets/${id}/status`, { method: 'PATCH', body: { status, note: note || null } }); setNote(''); });
  const addComment = (e) => {
    e.preventDefault();
    run(async () => { await api(`/tickets/${id}/comments`, { method: 'POST', body: { content: text } }); setText(''); });
  };
  const assign = () =>
    run(() => api(`/tickets/${id}/assign`, { method: 'PATCH', body: { staffId: +staffId, dueDate: due ? new Date(due).toISOString() : null } }));
  const setPriority = (priority) =>
    run(() => api(`/tickets/${id}/priority`, { method: 'PATCH', body: { priority } }));
  const sendFeedback = (e) => {
    e.preventDefault();
    run(() => api(`/tickets/${id}/feedback`, { method: 'POST', body: { rating: +fb.rating, comment: fb.comment || null } }));
  };

  if (!t) return <><Err msg={err} />{!err && <p>Đang tải...</p>}</>;
  const actions = actionsFor(t, user);
  const closed = t.status === 'Closed' || t.status === 'Cancelled';

  return (
    <>
      <Err msg={err} />
      <div className="card">
        <div className="row">
          <h2>{t.code} — {t.title}</h2>
          <span className="spacer" />
          <StatusBadge s={t.status} /> <PriorityBadge p={t.priority} />
        </div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>
        <p className="muted">
          Danh mục: {t.category} · Người tạo: {t.createdBy} · Người xử lý: {t.assignedTo || 'chưa phân công'} ·
          Tạo lúc: {fmt(t.createdAt)} · Hạn: {fmt(t.dueDate)}
        </p>

        {actions.length > 0 && (
          <div className="row">
            <input placeholder="Ghi chú (bắt buộc khi Resolved)" value={note} onChange={(e) => setNote(e.target.value)} />
            {actions.map(([s, label]) => <button key={label} className="primary" onClick={() => changeStatus(s)}>{label}</button>)}
          </div>
        )}
      </div>

      {user.role === 'Admin' && !closed && (
        <div className="card">
          <h3>Admin: phân công / ưu tiên</h3>
          <div className="row">
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">-- Chọn Staff --</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="primary" disabled={!staffId} onClick={assign}>Phân công</button>
            <select value={t.priority} onChange={(e) => setPriority(e.target.value)}>
              {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>Trao đổi</h3>
          {comments.map((c) => (
            <div key={c.id} className="comment"><b>{c.userName}</b> <span className="muted">{fmt(c.createdAt)}</span><div>{c.content}</div></div>
          ))}
          {comments.length === 0 && <p className="muted">Chưa có bình luận.</p>}
          {!closed && (
            <form className="row" onSubmit={addComment}>
              <input placeholder="Viết bình luận..." value={text} onChange={(e) => setText(e.target.value)} required />
              <button className="primary">Gửi</button>
            </form>
          )}
        </div>

        <div className="card">
          <h3>Lịch sử trạng thái</h3>
          <table><tbody>
            {history.map((h, i) => (
              <tr key={i}><td>{fmt(h.changedAt)}</td><td>{h.changedBy}</td><td>{h.oldStatus} → {h.newStatus}</td><td>{h.note}</td></tr>
            ))}
            {history.length === 0 && <tr><td className="muted">Chưa có thay đổi.</td></tr>}
          </tbody></table>
        </div>
      </div>

      {(feedback || (t.status === 'Closed' && t.createdById === user.userId)) && (
        <div className="card">
          <h3>Đánh giá</h3>
          {feedback ? (
            <p>{'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)} {feedback.comment}</p>
          ) : (
            <form className="row" onSubmit={sendFeedback}>
              <select value={fb.rating} onChange={(e) => setFb({ ...fb, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} sao</option>)}
              </select>
              <input placeholder="Nhận xét" value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} />
              <button className="primary">Gửi đánh giá</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
