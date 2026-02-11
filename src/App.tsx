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
import ClientsList from "@/pages/ClientsList";
import ClientDetail from "@/pages/ClientDetail";
import RevenueReport from "@/pages/RevenueReport";
import Maintenance from "@/pages/Maintenance";
import Financials from "@/pages/Financials";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const HomePage = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminHome /> : <ClientHome />;
};

const AppRoutes = () => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<PrivateRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          {/* Structures & Stations - available to all roles */}
          <Route path="/structures" element={<div className="p-6 text-muted-foreground">Strutture — In arrivo nella Fase 2</div>} />
          <Route path="/structures/:id" element={<div className="p-6 text-muted-foreground">Dettaglio Struttura — In arrivo nella Fase 2</div>} />
          <Route path="/stations" element={<div className="p-6 text-muted-foreground">Stazioni — In arrivo nella Fase 2</div>} />
          <Route path="/stations/:id" element={<div className="p-6 text-muted-foreground">Dettaglio Stazione — In arrivo nella Fase 2</div>} />
          {/* Maintenance - all roles */}
          <Route path="/maintenance" element={<Maintenance />} />
          {/* Admin-only */}
          {isAdmin && (
            <>
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/revenue" element={<RevenueReport />} />
            </>
          )}
          {/* Partner & Admin - fiscalità */}
          <Route path="/financials" element={<Financials />} />
          <Route path="/settings" element={<Settings />} />
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
