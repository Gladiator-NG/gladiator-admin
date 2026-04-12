import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './ui/AppLayout';
import ProtectedRoutes from './ui/ProtectedRoutes';
import SignIn from './pages/SignIn';
import AdminRoute from './ui/AdminRoute';
import ScrollToTop from './ui/ScrollToTop';

const DashboardHome = lazy(() => import('./features/dashboard/DashboardHome'));
const BookingsHome = lazy(() => import('./features/bookings/BookingsHome'));
const BoatsHome = lazy(() => import('./features/boats/BoatsHome'));
const BeachHousesHome = lazy(
  () => import('./features/beach-houses/BeachHousesHome'),
);
const UsersHome = lazy(() => import('./features/users/UsersHome'));
const ProfileHome = lazy(() => import('./features/profile/ProfileHome'));
const HelpPage = lazy(() => import('./features/help/HelpPage'));
const LocationsHome = lazy(() => import('./features/locations/LocationsHome'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={null}>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/dashboard" replace />}
                />
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
                  <Route path="locations" element={<LocationsHome />} />
                </Route>
                {/* Help — protected but no AppLayout wrapper */}
                <Route
                  path="help"
                  element={
                    <ProtectedRoutes>
                      <HelpPage />
                    </ProtectedRoutes>
                  }
                />
              </Routes>
            </Suspense>
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
    </ThemeProvider>
  );
}

export default App;
