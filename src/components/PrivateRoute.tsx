import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const ALLOWED_ROLES = ["admin", "partner", "manager"];

export const PrivateRoute = () => {
  const { user, role, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Wait for profile to load before checking role
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Block users without an allowed role
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
};
