import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CURRENT_ROLE } from "@/lib/mock-data";
import AdminHome from "@/pages/AdminHome";
import ClientHome from "@/pages/ClientHome";
import StationsList from "@/pages/StationsList";
import StationDashboard from "@/pages/StationDashboard";
import ClientsList from "@/pages/ClientsList";
import ClientDetail from "@/pages/ClientDetail";
import RevenueReport from "@/pages/RevenueReport";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<DashboardLayout />}>
            <Route path="/" element={CURRENT_ROLE === 'ADMIN' ? <AdminHome /> : <ClientHome />} />
            <Route path="/stations" element={<StationsList />} />
            <Route path="/stations/:id" element={<StationDashboard />} />
            {CURRENT_ROLE === 'ADMIN' && (
              <>
                <Route path="/clients" element={<ClientsList />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
              </>
            )}
            {CURRENT_ROLE === 'CLIENTE' && (
              <>
                <Route path="/discounts" element={<ClientHome />} />
                <Route path="/settings" element={<Settings />} />
              </>
            )}
            <Route path="/revenue" element={<RevenueReport />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
