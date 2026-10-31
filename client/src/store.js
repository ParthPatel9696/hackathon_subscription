import { create } from 'zustand';

const loadUser = () => {
  try { return JSON.parse(localStorage.getItem('brightloop_user') || 'null'); }
  catch { localStorage.removeItem('brightloop_user'); return null; }
};

export const useAuthStore = create((set) => ({
  user: loadUser(),
  setSession: (user) => {
    // Session credentials stay in the server's HttpOnly cookie, not localStorage.
    localStorage.removeItem('brightloop_token');
    localStorage.setItem('brightloop_user', JSON.stringify(user));
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    set({ user: null });
  }
}));
