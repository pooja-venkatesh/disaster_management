import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { verifyEmailOtp, resendVerificationOtp } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

const ROLE_HOME = {
  victim:  '/victim/dashboard',
  shelter: '/shelter/dashboard',
  admin:   '/admin/dashboard',
};

const STORE_KEY = 'drms_pending_verification';

// sessionStorage only survives a page refresh for convenience; the server is
// the source of truth and re-checks everything on every call.
const readStored = () => {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || null; } catch { return null; }
};
const writeStored = (v) => {
  try { v ? sessionStorage.setItem(STORE_KEY, JSON.stringify(v)) : sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
};

const VerifyEmail = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [session, setSession] = useState(() => {
    const s = location.state;
    if (s?.verificationToken) return { email: s.email, verificationToken: s.verificationToken };
    return readStored();
  });
  const [otp, setOtp]         = useState('');
  const [error, setError]     = useState(location.state?.emailSent === false ? (location.state?.notice || '') : '');
  const [info, setInfo]       = useState(location.state?.emailSent === false ? '' : (location.state?.notice || ''));
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown]   = useState(Number(location.state?.resendIn) || 0);

  useEffect(() => { if (session) writeStored(session); }, [session]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const expireSession = () => { writeStored(null); setSession(null); };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await verifyEmailOtp({ verificationToken: session.verificationToken, otp });
      const { user, token } = res.data.data;
      writeStored(null);
      login(user, token);
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'VERIFICATION_SESSION_INVALID') { expireSession(); return; }
      if (data?.code === 'ALREADY_VERIFIED') { writeStored(null); setAlreadyVerified(true); return; }
      setError(data?.message || 'Verification failed. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await resendVerificationOtp({ verificationToken: session.verificationToken });
      setInfo(res.data.message);
      setCooldown(Number(res.data.data?.resendAvailableInSeconds) || 60);
      setOtp('');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'VERIFICATION_SESSION_INVALID') { expireSession(); return; }
      if (data?.code === 'ALREADY_VERIFIED') { writeStored(null); setAlreadyVerified(true); return; }
      setError(data?.message || 'Could not resend the code. Please try again.');
      if (data?.data?.retryAfter) setCooldown(Number(data.data.retryAfter));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card" id="verify-email-card">
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

        {alreadyVerified ? (
          <>
            <h2 className="auth-title">Already verified</h2>
            <p className="auth-subtitle">This email is already verified. You can sign in now.</p>
            <p className="auth-switch"><Link to="/login">Go to sign in</Link></p>
          </>
        ) : !session ? (
          <>
            <h2 className="auth-title">Verification session expired</h2>
            <p className="auth-subtitle">
              Please sign in with your email and password to get a new verification code,
              or register again.
            </p>
            <p className="auth-switch">
              <Link to="/login" id="verify-goto-login">Sign in</Link> · <Link to="/register">Register</Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="auth-title">Verify your email</h2>
            <p className="auth-subtitle">
              Enter the 6-digit code we sent to <strong>{session.email}</strong>. It expires in 10 minutes.
            </p>

            {info  && <div className="auth-info" role="status">{info}</div>}
            {error && (
              <div className="auth-error" role="alert">
                <span>!</span> {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="otp-input">Verification code</label>
                <input
                  id="otp-input"
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="······"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  autoFocus
                />
              </div>

              <button
                id="verify-submit-btn"
                type="submit"
                className="btn-primary"
                disabled={loading || otp.length !== 6}
              >
                {loading ? <span className="btn-spinner" /> : 'Verify'}
              </button>

              <button
                id="resend-code-btn"
                type="button"
                className="btn-secondary"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                {resending ? 'Sending…' : cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
              </button>
            </form>

            <p className="auth-switch">
              Wrong email? <Link to="/register" id="verify-goto-register">Register again</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
