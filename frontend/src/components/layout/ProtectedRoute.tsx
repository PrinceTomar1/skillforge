import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "../ui";
import type { Role } from "../../types";

export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={user.role === "INSTRUCTOR" ? "/instructor" : "/dashboard"} replace />;
  }
  return <Outlet />;
}
