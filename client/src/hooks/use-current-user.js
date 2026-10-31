import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/api.js';
import { useAuthStore } from '../store/auth-store.js';

export function useCurrentUser() {
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await authApi.me();
      setUser(data.data.user);
      return data.data.user;
    },
    retry: false
  });
}
