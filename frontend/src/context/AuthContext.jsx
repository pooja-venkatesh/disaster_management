import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe } from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('drms_token'));
  const [loading, setLoading] = useState(true);

  // On mount (or token change) verify the token and hydrate user state
  useEffect(() => {
    const hydrate = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetchMe();
        setUser(res.data.data.user);
      } catch {
        // Token is invalid/expired — clear it
        localStorage.removeItem('drms_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    hydrate();
  }, [token]);

  const login = useCallback((userData, jwtToken) => {
    localStorage.setItem('drms_token', jwtToken);
    setToken(jwtToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('drms_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy consumption
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
