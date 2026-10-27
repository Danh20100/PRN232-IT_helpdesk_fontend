import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, PriorityBadge, StatusBadge, fmt, STATUS_LABEL } from '../ui';

export default function Tickets() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState({ search: '', status: '', categoryId: '', page: 1 });
  const [err, setErr] = useState('');

  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== '' && p.set(k, v));
    api('/tickets?' + p).then(setData).catch((e) => setErr(e.message));
  }, [q]);

  const upd = (k) => (e) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <div className="row">
        <h2>Danh sách ticket</h2>
        <span className="spacer" />
        {user.role === 'User' && <Link className="btn primary" to="/tickets/new">+ Tạo ticket</Link>}
      </div>
      <Err msg={err} />
      <div className="row">
        <input placeholder="Tìm theo tiêu đề / mã" value={q.search} onChange={upd('search')} />
        <select value={q.status} onChange={upd('status')}>
          <option value="">Mọi trạng thái</option>
          {Object.keys(STATUS_LABEL).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={q.categoryId} onChange={upd('categoryId')}>
          <option value="">Mọi danh mục</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <table className="card">
        <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Danh mục</th><th>Ưu tiên</th><th>Trạng thái</th><th>Người xử lý</th><th>Tạo lúc</th></tr></thead>
        <tbody>
          {data.items.map((t) => (
            <tr key={t.id} className={t.priority === 'Critical' ? 'critical' : ''}>
              <td><Link to={`/tickets/${t.id}`}>{t.code}</Link></td>
              <td>{t.title}</td>
              <td>{t.category}</td>
              <td><PriorityBadge p={t.priority} /></td>
              <td><StatusBadge s={t.status} /></td>
              <td>{t.assignedTo || '—'}</td>
              <td>{fmt(t.createdAt)}</td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan="7">Không có ticket nào.</td></tr>}
        </tbody>
      </table>

      <div className="row">
        <button disabled={q.page <= 1} onClick={() => setQ({ ...q, page: q.page - 1 })}>‹ Trước</button>
        <span>Trang {data.page}/{pages}</span>
        <button disabled={q.page >= pages} onClick={() => setQ({ ...q, page: q.page + 1 })}>Sau ›</button>
      </div>
    </>
  );
}
