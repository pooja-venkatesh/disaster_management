import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('drms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser    = (data) => API.post('/auth/login', data);
export const fetchMe      = ()     => API.get('/auth/me');
export const verifyEmailOtp        = (data) => API.post('/auth/verify-email', data);
export const resendVerificationOtp = (data) => API.post('/auth/resend-verification', data);
export const forgotPassword        = (data) => API.post('/auth/forgot-password', data);
export const validateResetToken    = (data) => API.post('/auth/reset-password/validate', data);
export const resetPassword         = (data) => API.post('/auth/reset-password', data);

// ── Victim ────────────────────────────────────────────────────────────
export const fetchVictimDashboard = ()       => API.get('/victim/dashboard');
export const submitRequest        = (data)   => API.post('/victim/requests', data);
export const fetchMyRequests      = (params) => API.get('/victim/requests', { params });
export const fetchRequestDetail   = (id)     => API.get(`/victim/requests/${id}`);
export const cancelRequest        = (id)     => API.delete(`/victim/requests/${id}`);
export const fetchPublicShelters  = ()       => API.get('/shelters');
export const fetchPublicShelterDetail = (id) => API.get(`/shelters/${id}`);

// ── Shelter ───────────────────────────────────────────────────────────
export const fetchShelterDashboard  = ()               => API.get('/shelter/dashboard');
export const fetchShelterProfile    = ()               => API.get('/shelter/profile');
export const saveShelterProfile     = (data)           => API.post('/shelter/profile', data);
export const getShelterRequests     = (status = 'pending') => API.get('/shelter/requests', { params: { status } });
export const fetchShelterHistory    = ()               => API.get('/shelter/history');
export const acceptRequest          = (assignId)       => API.put(`/shelter/requests/${assignId}/accept`);
export const rejectRequest          = (assignId, notes) => API.put(`/shelter/requests/${assignId}/reject`, { notes });
export const fulfillRequest         = (assignId)       => API.put(`/shelter/requests/${assignId}/fulfill`);

// ── Admin ─────────────────────────────────────────────────────────────
export const fetchAdminDashboard     = ()       => API.get('/admin/dashboard');
export const fetchAllShelters        = (params) => API.get('/admin/shelters', { params });
export const verifyShelter           = (id)     => API.put(`/admin/shelters/${id}/verify`);
export const revokeShelter           = (id)     => API.put(`/admin/shelters/${id}/revoke`);
export const unverifyShelter         = (id)     => API.put(`/admin/shelters/${id}/revoke`); // alias
export const fetchAllRequests        = (params) => API.get('/admin/requests', { params });
export const fetchUnresolvedRequests = ()       => API.get('/admin/requests/unresolved');
export const fetchUnresolved         = ()       => API.get('/admin/unresolved'); // alias
export const resolveRequest          = (id, data) => API.put(`/admin/requests/${id}/resolve`, data);
export const fetchAllUsers           = (params) => API.get('/admin/users', { params });
export const toggleUserActive        = (id)     => API.put(`/admin/users/${id}/toggle-active`);

// ── Notifications ─────────────────────────────────────────────────────
export const fetchNotifications = ()   => API.get('/notifications');
export const markAllRead        = ()   => API.put('/notifications/read-all');
export const markOneRead        = (id) => API.put(`/notifications/${id}/read`);

// ── Inventory ─────────────────────────────────────────────────────────
export const fetchInventory    = ()     => API.get('/shelter/inventory');
export const updateInventory   = (data) => API.put('/shelter/inventory', data);
export const fetchAllInventory = ()     => API.get('/admin/inventory');

// ── Analytics ─────────────────────────────────────────────────────────
export const fetchAnalytics = () => API.get('/admin/analytics');

export default API;
