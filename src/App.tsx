import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { handleAppError } from "@/lib/globalErrorHandler";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/PrivateRoute";
import AdminHome from "@/pages/AdminHome";
import ClientHome from "@/pages/ClientHome";
import Onboarding from "@/pages/Onboarding";
import StructuresList from "@/pages/StructuresList";
import Packages from "@/pages/Packages";
import StructureDetail from "@/pages/StructureDetail";
import StationsList from "@/pages/StationsList";
import StationDetail from "@/pages/StationDetail";
import ClientsList from "@/pages/ClientsList";
import ClientDetail from "@/pages/ClientDetail";
import CreatePartner from "@/pages/CreatePartner";
import Maintenance from "@/pages/Maintenance";
import Financials from "@/pages/Financials";
import Settings from "@/pages/Settings";
import AdminSettings from "@/pages/AdminSettings";
import Revenue from "@/pages/Revenue";
import ProductsCatalog from "@/pages/ProductsCatalog";
import Inventory from "@/pages/Inventory";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";
import UpdatePassword from "@/pages/auth/UpdatePassword";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toast for queries that have already loaded data (refetch errors)
      // Initial load errors are handled by individual components
      if (query.state.data !== undefined) {
        handleAppError(error, `QueryCache: ${query.queryKey}`, { silent: false });
      } else {
        handleAppError(error, `QueryCache: ${query.queryKey}`, { silent: true });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      handleAppError(error, `MutationCache: ${mutation.options.mutationKey ?? "unknown"}`);
    },
  }),
});

const HomePage = () => {
  const { isAdmin, profile } = useAuth();
  // Redirect to onboarding if must_change_password
  if ((profile as any)?.must_change_password) {
    return <Navigate to="/onboarding" replace />;
  }
  return isAdmin ? <AdminHome /> : <ClientHome />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth/update-password" element={<UpdatePassword />} />
      <Route element={<PrivateRoute />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/structures" element={<StructuresList />} />
          <Route path="/structures/:id" element={<StructureDetail />} />
          <Route path="/stations" element={<StationsList />} />
          <Route path="/stations/:id" element={<StationDetail />} />
          <Route path="/clients" element={<ClientsList />} />
          <Route path="/clients/new" element={<CreatePartner />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/products" element={<ProductsCatalog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/admin-settings" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
