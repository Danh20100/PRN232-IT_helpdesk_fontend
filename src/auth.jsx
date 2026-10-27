import { createContext, useContext, useState } from 'react';
import { getAuth, setAuth } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getAuth()); // { token, userId, fullName, role }
  const login = (a) => { setAuth(a); setUser(a); };
  const logout = () => { setAuth(null); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
