import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

const ROLE_HOME = {
  victim:  '/victim/dashboard',
  shelter: '/shelter/dashboard',
  admin:   '/admin/dashboard',
};

const Login = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res  = await loginUser(form);
      const { user, token } = res.data.data;
      login(user, token);
      const destination = location.state?.from?.pathname || ROLE_HOME[user.role];
      navigate(destination, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'EMAIL_NOT_VERIFIED' && data.data?.verificationToken) {
        navigate('/verify-email', {
          state: {
            email: data.data.email,
            verificationToken: data.data.verificationToken,
            notice: 'Your email address is not verified yet. Enter the code we sent you, or request a new one.',
          },
        });
        return;
      }
      setError(data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card" id="login-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="44" height="44" rx="12" fill="#EF3333"/>
              <path d="M22 10L32 16V24C32 29.5 27.5 34.5 22 36C16.5 34.5 12 29.5 12 24V16L22 10Z" fill="white"/>
            </svg>
          </div>
          <h1 className="auth-brand">DisasterRM</h1>
          <p className="auth-tagline">Resource Management System</p>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to access your dashboard</p>

        {error && (
          <div className="auth-error" role="alert">
            <span>!</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="forgot-row">
            <Link to="/forgot-password" id="forgot-password-link">Forgot password?</Link>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <Link to="/register" id="goto-register-link">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
