/**
 * rateLimiter.js
 * Small dependency-free, in-memory, per-IP fixed-window limiter used on the
 * email-verification / password-reset endpoints (in addition to the per-account
 * limits enforced in the database).
 *
 * Behind a reverse proxy (nginx / AWS ALB) set TRUST_PROXY=1 in .env so
 * req.ip is the real client address. State is per Node process.
 */
const createRateLimiter = ({ windowMs, max, message = 'Too many requests. Please try again later.' }) => {
  const hits = new Map(); // ip -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  sweep.unref();

  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, code: 'RATE_LIMITED', message, data: { retryAfter } });
    }
    next();
  };
};

module.exports = { createRateLimiter };
