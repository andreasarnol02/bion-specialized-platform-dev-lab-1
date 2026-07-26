import { Navigate, Outlet, useLocation } from "react-router-dom";

import Loading from "./Loading";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ requireAdmin = false }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();

  // Wait for the stored token to be validated. Redirecting here would bounce
  // a legitimate admin to /login on every page refresh.
  if (status === "loading") {
    return <Loading />;
  }

  if (status === "guest") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A logged-in non-admin goes home, not to /login. They are already
  // authenticated, so the login page would send them straight back here.
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
