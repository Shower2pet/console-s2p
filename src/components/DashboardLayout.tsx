import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";

export const DashboardLayout = () => (
  <div className="flex min-h-screen w-full">
    <AppSidebar />
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  </div>
);
