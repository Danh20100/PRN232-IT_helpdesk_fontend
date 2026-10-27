import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import Admin from './pages/Admin';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="nav">
        <strong>IT Helpdesk</strong>
        <Link to="/">Dashboard</Link>
        <Link to="/tickets">Tickets</Link>
        {user.role === 'Admin' && <Link to="/admin">Quản trị</Link>}
        <span className="spacer" />
        <span>{user.fullName} ({user.role})</span>
        <button onClick={() => { logout(); nav('/login'); }}>Đăng xuất</button>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
      <Route path="/tickets/new" element={<Protected roles={['User']}><NewTicket /></Protected>} />
      <Route path="/tickets/:id" element={<Protected><TicketDetail /></Protected>} />
      <Route path="/admin" element={<Protected roles={['Admin']}><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
