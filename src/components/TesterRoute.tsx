import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const TESTER_ALLOWED_ROLES = ["admin", "tester"];

/** Blocks access to tester routes for non-tester/admin users */
export const TesterRoute = () => {
  const { role } = useAuth();

  if (!role || !TESTER_ALLOWED_ROLES.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
};
