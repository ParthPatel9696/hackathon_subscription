import { create } from 'zustand';

const storedUser = localStorage.getItem('brightloop_user');

export const useAuthStore = create((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  setSession: (user, token) => {
    localStorage.setItem('brightloop_user', JSON.stringify(user));
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem('brightloop_user');
    set({ user: null });
  }
}));
