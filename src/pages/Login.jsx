import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err } from '../ui';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [register, setRegister] = useState(false);
  const [f, setF] = useState({ fullName: '', email: '', password: '', phoneNumber: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const body = register ? f : { email: f.email, password: f.password };
      login(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body }));
      nav('/');
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h2>{register ? 'Đăng ký' : 'Đăng nhập'}</h2>
      <Err msg={err} />
      {register && <input placeholder="Họ tên" value={f.fullName} onChange={set('fullName')} required />}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Mật khẩu" value={f.password} onChange={set('password')} required />
      {register && <input placeholder="Số điện thoại (không bắt buộc)" value={f.phoneNumber} onChange={set('phoneNumber')} />}
      <button className="primary">{register ? 'Đăng ký' : 'Đăng nhập'}</button>
      <a href="#" onClick={(e) => { e.preventDefault(); setRegister(!register); setErr(''); }}>
        {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
      </a>
    </form>
  );
}
