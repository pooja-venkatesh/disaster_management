import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider }        from './context/SocketContext';

// Auth
import Login    from './pages/Login';
import Register from './pages/Register';
import VerifyEmail    from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';

// Victim
import VictimDashboard from './pages/victim/VictimDashboard';
import NewRequest      from './pages/victim/NewRequest';
import MyRequests      from './pages/victim/MyRequests';
import RequestDetail   from './pages/victim/RequestDetail';
import VictimShelters  from './pages/victim/VictimShelters';

// Shelter
import ShelterDashboard from './pages/shelter/ShelterDashboard';
import ShelterSetup     from './pages/shelter/ShelterSetup';
import IncomingRequests from './pages/shelter/IncomingRequests';
import ShelterHistory   from './pages/shelter/ShelterHistory';
import Inventory        from './pages/shelter/Inventory';

// Admin
import AdminDashboard   from './pages/admin/AdminDashboard';
import ManageShelters   from './pages/admin/ManageShelters';
import AllRequests      from './pages/admin/AllRequests';
import UnresolvedAlerts from './pages/admin/UnresolvedAlerts';
import Analytics        from './pages/admin/Analytics';
import MapView          from './pages/admin/MapView';

const ROLE_HOME = {
  victim:  '/victim/dashboard',
  shelter: '/shelter/dashboard',
  admin:   '/admin/dashboard',
};

const PageLoader = () => (
  <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px' }}>
    <div style={{ width:36, height:36, border:'3px solid #e5e7eb', borderTopColor:'#EF3333', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    <span style={{ fontSize:'0.85rem', color:'#6b7280', fontWeight:600 }}>Loading DisasterRM...</span>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole)
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user)    return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
};

const SmartRoot = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<SmartRoot />} />

      {/* Public */}
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/verify-email"    element={<PublicRoute><VerifyEmail /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      {/* Not wrapped in PublicRoute: a reset link must work even if someone is already signed in */}
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* Victim */}
      <Route path="/victim/dashboard"    element={<ProtectedRoute allowedRole="victim"><VictimDashboard /></ProtectedRoute>} />
      <Route path="/victim/request/new"  element={<ProtectedRoute allowedRole="victim"><NewRequest /></ProtectedRoute>} />
      <Route path="/victim/shelters"     element={<ProtectedRoute allowedRole="victim"><VictimShelters /></ProtectedRoute>} />
      <Route path="/victim/requests"     element={<ProtectedRoute allowedRole="victim"><MyRequests /></ProtectedRoute>} />
      <Route path="/victim/requests/:id" element={<ProtectedRoute allowedRole="victim"><RequestDetail /></ProtectedRoute>} />

      {/* Shelter */}
      <Route path="/shelter/dashboard" element={<ProtectedRoute allowedRole="shelter"><ShelterDashboard /></ProtectedRoute>} />
      <Route path="/shelter/setup"     element={<ProtectedRoute allowedRole="shelter"><ShelterSetup /></ProtectedRoute>} />
      <Route path="/shelter/requests"  element={<ProtectedRoute allowedRole="shelter"><IncomingRequests /></ProtectedRoute>} />
      <Route path="/shelter/history"   element={<ProtectedRoute allowedRole="shelter"><ShelterHistory /></ProtectedRoute>} />
      <Route path="/shelter/inventory" element={<ProtectedRoute allowedRole="shelter"><Inventory /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/dashboard"  element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/shelters"   element={<ProtectedRoute allowedRole="admin"><ManageShelters /></ProtectedRoute>} />
      <Route path="/admin/map"        element={<ProtectedRoute allowedRole="admin"><MapView /></ProtectedRoute>} />
      <Route path="/admin/requests"   element={<ProtectedRoute allowedRole="admin"><AllRequests /></ProtectedRoute>} />
      <Route path="/admin/unresolved" element={<ProtectedRoute allowedRole="admin"><UnresolvedAlerts /></ProtectedRoute>} />
      <Route path="/admin/analytics"  element={<ProtectedRoute allowedRole="admin"><Analytics /></ProtectedRoute>} />

      <Route path="*" element={<SmartRoot />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
