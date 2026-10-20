import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * - Redirects to /login if not authenticated
 * - Redirects to own dashboard if authenticated but wrong role
 * - allowedRoles: array of roles that can access this route
 */

const ROLE_HOME = {
  victim:  '/victim/dashboard',
  shelter: '/shelter/dashboard',
  admin:   '/admin/dashboard',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="splash-loader">
        <div className="splash-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their correct dashboard instead of showing 403
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
