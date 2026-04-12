import type { ReactNode } from 'react';
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
import MetaTags from './ui/MetaTags';

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

interface RouteMeta {
  title: string;
  description: string;
}

function withMeta(meta: RouteMeta, element: ReactNode) {
  return (
    <>
      <MetaTags title={meta.title} description={meta.description} />
      {element}
    </>
  );
}

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
                <Route
                  path="signin"
                  element={withMeta(
                    {
                      title: 'Sign In',
                      description:
                        'Sign in to Gladiator Admin to manage bookings, transport, boats, beach houses, and team operations.',
                    },
                    <SignIn />,
                  )}
                />
                <Route
                  element={
                    <ProtectedRoutes>
                      <AppLayout />
                    </ProtectedRoutes>
                  }
                >
                  <Route
                    path="dashboard"
                    element={withMeta(
                      {
                        title: 'Dashboard',
                        description:
                          'View the operational overview for bookings, boats, beach houses, transport, and recent activity in Gladiator Admin.',
                      },
                      <DashboardHome />,
                    )}
                  />
                  <Route
                    path="bookings"
                    element={withMeta(
                      {
                        title: 'Bookings',
                        description:
                          'Manage customer bookings, confirm reservations, and keep transport and accommodation operations organized.',
                      },
                      <BookingsHome />,
                    )}
                  />
                  <Route
                    path="boats"
                    element={withMeta(
                      {
                        title: 'Boats',
                        description:
                          'Manage the boat fleet, availability, details, and pricing used across Gladiator bookings.',
                      },
                      <BoatsHome />,
                    )}
                  />
                  <Route
                    path="beach-houses"
                    element={withMeta(
                      {
                        title: 'Beach Houses',
                        description:
                          'Manage beach house inventory, property details, and availability from the Gladiator Admin dashboard.',
                      },
                      <BeachHousesHome />,
                    )}
                  />
                  <Route
                    path="users"
                    element={withMeta(
                      {
                        title: 'Users',
                        description:
                          'Manage admin users, access, and team visibility inside Gladiator Admin.',
                      },
                      <AdminRoute>
                        <UsersHome />
                      </AdminRoute>,
                    )}
                  />
                  <Route
                    path="profile"
                    element={withMeta(
                      {
                        title: 'Profile',
                        description:
                          'Update your account profile and personal admin settings in Gladiator Admin.',
                      },
                      <ProfileHome />,
                    )}
                  />
                  <Route
                    path="locations"
                    element={withMeta(
                      {
                        title: 'Transport Locations',
                        description:
                          'Manage transport locations, pricing routes, and curfew settings used for booking logistics.',
                      },
                      <LocationsHome />,
                    )}
                  />
                </Route>
                {/* Help — protected but no AppLayout wrapper */}
                <Route
                  path="help"
                  element={withMeta(
                    {
                      title: 'Help',
                      description:
                        'Access help resources and support information for using Gladiator Admin effectively.',
                    },
                    <ProtectedRoutes>
                      <HelpPage />
                    </ProtectedRoutes>,
                  )}
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
