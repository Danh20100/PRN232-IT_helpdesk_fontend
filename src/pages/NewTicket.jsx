import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Err } from '../ui';

export default function NewTicket() {
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({ title: '', description: '', categoryId: '', priority: 'Medium' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api('/categories').then(setCats).catch((e) => setErr(e.message)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const t = await api('/tickets', { method: 'POST', body: { ...f, categoryId: +f.categoryId } });
      nav(`/tickets/${t.id}`);
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Tạo yêu cầu hỗ trợ</h2>
      <Err msg={err} />
      <input placeholder="Tiêu đề" value={f.title} onChange={set('title')} required />
      <textarea rows="5" placeholder="Mô tả sự cố" value={f.description} onChange={set('description')} required />
      <select value={f.categoryId} onChange={set('categoryId')} required>
        <option value="">-- Chọn danh mục --</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={f.priority} onChange={set('priority')}>
        {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
      </select>
      <button className="primary">Gửi yêu cầu</button>
    </form>
  );
}
