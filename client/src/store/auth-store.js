import { create } from 'zustand';
import { authApi } from '../services/api.js';

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  logout: async () => {
    await authApi.logout();
    set({ user: null });
  }
}));
