import { useEffect, useState } from 'react';
import { api } from '../api';
import { Err } from '../ui';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try { setUsers(await api('/users')); setCats(await api('/categories')); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => { setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const setRole = (u, role) => run(() => api(`/users/${u.id}/role`, { method: 'PATCH', body: { role } }));
  const toggleUser = (u) => run(() => api(`/users/${u.id}/status`, { method: 'PATCH', body: { isActive: !u.isActive } }));
  const addCat = (e) => { e.preventDefault(); run(async () => { await api('/categories', { method: 'POST', body: { name } }); setName(''); }); };
  const rename = (c) => {
    const n = window.prompt('Tên danh mục mới', c.name);
    if (n) run(() => api(`/categories/${c.id}`, { method: 'PUT', body: { name: n, description: c.description } }));
  };
  const toggleCat = (c) => run(() => api(`/categories/${c.id}/status`, { method: 'PATCH', body: { isActive: !c.isActive } }));

  return (
    <>
      <Err msg={err} />
      <div className="card">
        <h3>Tài khoản</h3>
        <table>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Role</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td><td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => setRole(u, e.target.value)}>
                    {['User', 'Staff', 'Admin'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td>
                <td><button onClick={() => toggleUser(u)}>{u.isActive ? 'Khóa' : 'Mở khóa'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Danh mục sự cố</h3>
        <table>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.isActive ? 'Đang dùng' : 'Đã vô hiệu hóa'}</td>
                <td><button onClick={() => rename(c)}>Đổi tên</button> <button onClick={() => toggleCat(c)}>{c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="row" onSubmit={addCat}>
          <input placeholder="Tên danh mục mới" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="primary">Thêm</button>
        </form>
      </div>
    </>
  );
}
