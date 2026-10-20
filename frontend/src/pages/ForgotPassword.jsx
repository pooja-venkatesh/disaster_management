import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/axios';
import '../styles/auth.css';

const ForgotPassword = () => {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await forgotPassword({ email: email.trim() });
      setMessage(res.data.message);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card" id="forgot-password-card">
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

        <h2 className="auth-title">Forgot your password?</h2>
        <p className="auth-subtitle">Enter your registered email and we&apos;ll send you a link to reset it.</p>

        {sent ? (
          <div className="auth-success" role="status" id="forgot-success">
            {message} The link expires in 15 minutes. Check your spam folder if you don&apos;t see it.
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-error" role="alert">
                <span>!</span> {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  required
                  autoComplete="email"
                />
              </div>
              <button id="forgot-submit-btn" type="submit" className="btn-primary" disabled={loading || !email.trim()}>
                {loading ? <span className="btn-spinner" /> : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">
          <Link to="/login" id="forgot-back-to-login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
