import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/axios';
import '../styles/auth.css';

const Register = () => {
  const navigate  = useNavigate();

  const [form, setForm]       = useState({ name: '', email: '', password: '', phone: '', role: 'victim' });
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
      const res = await registerUser(form);
      const d = res.data.data;
      // No session is created until the email is verified.
      navigate('/verify-email', {
        replace: true,
        state: {
          email: d.email,
          verificationToken: d.verificationToken,
          resendIn: d.resendAvailableInSeconds,
          notice: res.data.message,
          emailSent: d.emailSent,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card auth-card--wide" id="register-card">
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

        <h2 className="auth-title">Create an account</h2>
        <p className="auth-subtitle">Join the disaster relief network</p>

        {error && (
          <div className="auth-error" role="alert">
            <span>!</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Role selector */}
          <div className="role-selector">
            <button
              type="button"
              id="role-victim-btn"
              className={`role-btn role-btn--victim ${form.role === 'victim' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, role: 'victim' })}
            >
              <span className={`role-icon ${form.role === 'victim' ? '' : 'role-icon-victim'}`}>V</span>
              <span>I need help</span>
              <small>Victim</small>
            </button>
            <button
              type="button"
              id="role-shelter-btn"
              className={`role-btn role-btn--shelter ${form.role === 'shelter' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, role: 'shelter' })}
            >
              <span className={`role-icon ${form.role === 'shelter' ? '' : 'role-icon-shelter'}`}>S</span>
              <span>I provide shelter</span>
              <small>Shelter</small>
            </button>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-name">Full name</label>
              <input
                id="reg-name"
                type="text"
                name="name"
                placeholder="Jane Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-phone">Phone <span className="optional">(optional)</span></label>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email address</label>
            <input
              id="reg-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password <span className="optional">(min. 6 characters)</span></label>
            <input
              id="reg-password"
              type="password"
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading
              ? <span className="btn-spinner" />
              : `Register as ${form.role === 'victim' ? 'Victim' : 'Shelter'}`
            }
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" id="goto-login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
