import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { validateResetToken, resetPassword } from '../api/axios';
import '../styles/auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Keep the token in memory only and remove it from the address bar / history.
  const [token] = useState(() => params.get('token') || '');
  useEffect(() => {
    if (params.get('token')) navigate('/reset-password', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [status, setStatus]   = useState(token ? 'checking' : 'invalid'); // checking | valid | invalid | done
  const [invalidMsg, setInvalidMsg] = useState('This password reset link is invalid or incomplete. Please request a new one.');
  const [form, setForm]       = useState({ password: '', confirmPassword: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    validateResetToken({ token })
      .then(() => { if (!cancelled) setStatus('valid'); })
      .catch((err) => {
        if (cancelled) return;
        setInvalidMsg(err.response?.data?.message || invalidMsg);
        setStatus('invalid');
      });
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword({ token, ...form });
      setStatus('done');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'RESET_TOKEN_INVALID') {
        setInvalidMsg(data.message);
        setStatus('invalid');
      } else {
        setError(data?.message || 'Could not reset your password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card" id="reset-password-card">
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

        {status === 'checking' && <p className="auth-subtitle">Checking your reset link…</p>}

        {status === 'invalid' && (
          <>
            <h2 className="auth-title">Link not valid</h2>
            <div className="auth-error" role="alert" id="reset-invalid"><span>!</span> {invalidMsg}</div>
            <p className="auth-switch">
              <Link to="/forgot-password" id="reset-request-new">Request a new link</Link>
            </p>
          </>
        )}

        {status === 'done' && (
          <>
            <h2 className="auth-title">Password updated</h2>
            <div className="auth-success" role="status" id="reset-success">
              Your password has been changed. You can now sign in with your new password.
            </div>
            <p className="auth-switch"><Link to="/login" id="reset-goto-login">Go to sign in</Link></p>
          </>
        )}

        {status === 'valid' && (
          <>
            <h2 className="auth-title">Choose a new password</h2>
            <p className="auth-subtitle">Enter and confirm your new password.</p>
            {error && (
              <div className="auth-error" role="alert">
                <span>!</span> {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="reset-password">New password <span className="optional">(min. 6 characters)</span></label>
                <input id="reset-password" type="password" name="password" value={form.password}
                  onChange={handleChange} required autoComplete="new-password" placeholder="New password" />
              </div>
              <div className="form-group">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <input id="reset-confirm" type="password" name="confirmPassword" value={form.confirmPassword}
                  onChange={handleChange} required autoComplete="new-password" placeholder="Repeat new password" />
              </div>
              <button id="reset-submit-btn" type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
