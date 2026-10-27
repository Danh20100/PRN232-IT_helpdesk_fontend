// Gọi API backend. JWT lưu trong localStorage và tự gắn vào header Authorization.
export const getAuth = () => JSON.parse(localStorage.getItem('auth') || 'null');
export const setAuth = (a) =>
  a ? localStorage.setItem('auth', JSON.stringify(a)) : localStorage.removeItem('auth');

export async function api(path, { method = 'GET', body } = {}) {
  const auth = getAuth();
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth.token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && auth) {
    setAuth(null);
    window.location.href = '/login'; // token hết hạn
    return null;
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const validation = data?.errors && Object.values(data.errors).flat()[0];
    throw new Error(data?.error || validation || data?.title || `Lỗi ${res.status}`);
  }
  return data;
}
