import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BlogRoutes from './blog-routes';
import Index from './pages/Index';
import Login from './pages/Login';
import Workspace from './pages/Workspace';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import { useAuthStore } from './store/authStore';
// MODULE_IMPORTS_START
// MODULE_IMPORTS_END

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, hydrated } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/"
        element={
          hydrated ? (
            user ? <Navigate to="/workspace" replace /> : <Login />
          ) : (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/workspace" element={<Workspace />} />
      {/* <Route path="/blog/*" element={<BlogRoutes />} /> */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/error" element={<AuthError />} />
      {/* MODULE_ROUTES_START */}
      {/* MODULE_ROUTES_END */}
    </Routes>
  );
};

const App = () => {
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* MODULE_PROVIDERS_START */}
      {/* MODULE_PROVIDERS_END */}
      <TooltipProvider>
        <Toaster />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </TooltipProvider>
      {/* MODULE_PROVIDERS_CLOSE */}
    </QueryClientProvider>
  );
};

export default App;
export { AppRoutes };
