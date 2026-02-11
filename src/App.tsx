import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/PrivateRoute";
import AdminHome from "@/pages/AdminHome";
import ClientHome from "@/pages/ClientHome";
import StructuresList from "@/pages/StructuresList";
import Packages from "@/pages/Packages";
import StructureDetail from "@/pages/StructureDetail";
import StationsList from "@/pages/StationsList";
import ClientsList from "@/pages/ClientsList";
import ClientDetail from "@/pages/ClientDetail";
import Maintenance from "@/pages/Maintenance";
import Financials from "@/pages/Financials";
import Settings from "@/pages/Settings";
import AdminSettings from "@/pages/AdminSettings";
import Revenue from "@/pages/Revenue";
import Inventory from "@/pages/Inventory";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const HomePage = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminHome /> : <ClientHome />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<PrivateRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/structures" element={<StructuresList />} />
          <Route path="/structures/:id" element={<StructureDetail />} />
          <Route path="/stations" element={<StationsList />} />
          <Route path="/clients" element={<ClientsList />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/packages" element={<Packages />} />
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
