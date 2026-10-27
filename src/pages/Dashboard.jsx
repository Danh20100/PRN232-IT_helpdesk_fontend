import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err } from '../ui';

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api('/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <Err msg={err} />;
  if (!d) return <p>Đang tải...</p>;

  return (
    <>
      <h2>Dashboard</h2>
      <div className="cards">
        <div className="card stat"><b>{d.total}</b>Tổng số ticket</div>
        {Object.entries(d.byStatus).map(([k, v]) => (
          <div className="card stat" key={k}><b>{v}</b>{k}</div>
        ))}
        <div className="card stat"><b>{d.overdue}</b>Quá hạn</div>
        {user.role === 'Admin' && (
          <div className="card stat"><b>{d.averageRating ? d.averageRating.toFixed(1) : '-'}</b>Điểm hài lòng TB</div>
        )}
      </div>

      {user.role === 'Admin' && (
        <div className="grid2">
          <div className="card">
            <h3>Theo danh mục</h3>
            <table><tbody>{d.byCategory.map((x) => <tr key={x.category}><td>{x.category}</td><td>{x.count}</td></tr>)}</tbody></table>
          </div>
          <div className="card">
            <h3>Theo nhân viên</h3>
            <table>
              <thead><tr><th>Nhân viên</th><th>Được giao</th><th>Hoàn thành</th></tr></thead>
              <tbody>{d.byStaff.map((x) => <tr key={x.staff}><td>{x.staff}</td><td>{x.total}</td><td>{x.done}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
