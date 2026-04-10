import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import AppLayout from './ui/AppLayout';
import ProtectedRoutes from './ui/ProtectedRoutes';
import SignIn from './pages/SignIn';
import DashboardHome from './features/dashboard/DashboardHome';
import BookingsHome from './features/bookings/BookingsHome';
import BoatsHome from './features/boats/BoatsHome';
import BeachHousesHome from './features/beach-houses/BeachHousesHome';
import UsersHome from './features/users/UsersHome';
import ProfileHome from './features/profile/ProfileHome';
import AdminRoute from './ui/AdminRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
    },
  },
});

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="signin" element={<SignIn />} />
            <Route
              element={
                <ProtectedRoutes>
                  <AppLayout />
                </ProtectedRoutes>
              }
            >
              <Route path="dashboard" element={<DashboardHome />} />
              <Route path="bookings" element={<BookingsHome />} />
              <Route path="boats" element={<BoatsHome />} />
              <Route path="beach-houses" element={<BeachHousesHome />} />
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <UsersHome />
                  </AdminRoute>
                }
              />
              <Route path="profile" element={<ProfileHome />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          gutter={12}
          containerStyle={{ margin: '8px' }}
          toastOptions={{
            success: { duration: 3000 },
            error: { duration: 5000 },
            style: {
              fontSize: '14px',
              maxWidth: '500px',
              padding: '14px 22px',
            },
          }}
        />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
