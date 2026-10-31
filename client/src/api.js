import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
      if (error.response?.status === 401 && window.location.pathname.startsWith('/app') && !error.config?.url?.includes('/auth/logout')) {
        const hadSession = Boolean(localStorage.getItem('brightloop_user'));
      localStorage.removeItem('brightloop_token');
      localStorage.removeItem('brightloop_user');
        if (hadSession) window.location.assign('/session-expired');
    }
    return Promise.reject(error);
  }
);

export default api;
