import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './modules/auth/pages.jsx';
import { DashboardPage } from './modules/dashboard/pages.jsx';

const queryClient = new QueryClient();
createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardPage />} /></Route></Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
</BrowserRouter></QueryClientProvider></React.StrictMode>);
