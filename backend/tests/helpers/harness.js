/**
 * harness.js — boots the REAL auth routes/controllers/services with:
 *   • a SQLite stand-in for MySQL            (see sqliteDb.js)
 *   • a capturing mail transport instead of Gmail SMTP (emails are rendered by
 *     the real emailService templates and kept in `outbox`, never delivered)
 *   • DNS MX lookup stubbed (sandbox has no DNS)
 * Must be required BEFORE any file under src/.
 */
const path = require('path');
const http = require('http');
const express = require('express');

process.env.NODE_ENV           = 'test';
process.env.JWT_SECRET         = 'test-jwt-secret-not-for-production';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.EMAIL_USER         = 'sender@example.test';
process.env.EMAIL_PASS         = 'dummy-app-password';
process.env.CLIENT_URL         = 'http://localhost:3000';

const src = (p) => path.join(__dirname, '..', '..', 'src', p);
const { createDb } = require('./sqliteDb');
const db = createDb();

const inject = (file, exports) => {
  const filename = require.resolve(file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports, children: [], paths: [] };
};
inject(src('config/db.js'), { pool: db.pool, testConnection: db.testConnection });

// MX lookup stub
require('dns').promises.resolveMx = async () => [{ exchange: 'mx.test', priority: 10 }];

// Optionally neutralise the per-IP limiter (so functional tests aren't throttled)
if (!process.env.TEST_REAL_RATE_LIMITER) {
  inject(src('middleware/rateLimiter.js'), {
    createRateLimiter: () => (req, res, next) => next(),
  });
}

const emailService = require(src('services/emailService.js'));
const outbox = [];
let failMail = false;
emailService.__setTransporterForTests({
  sendMail: async (msg) => {
    if (failMail) throw new Error('SMTP connection refused (simulated)');
    outbox.push({ ...msg, at: Date.now() });
    return { messageId: 'test' };
  },
});

const authRoutes = require(src('routes/authRoutes.js'));
const { authenticate } = require(src('middleware/auth.js'));

const app = express();
app.use(require('cors')({ origin: true }));
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/protected', authenticate, (req, res) => res.json({ success: true, data: { id: req.user.user_id } }));

let server;
const start = (port = 0) => new Promise((resolve) => {
  server = http.createServer(app).listen(port, () => resolve(server.address().port));
});
const stop = () => new Promise((resolve) => (server ? server.close(resolve) : resolve()));

const bcrypt = require('bcrypt');
const seedUser = async ({ name, email, password, role = 'victim', active = 1 }) => {
  const hash = await bcrypt.hash(password, 4);
  // email_verified omitted on purpose → column DEFAULT (1), exactly like pre-existing rows after migration
  const [r] = await db.pool.query(
    'INSERT INTO users (name, email, password_hash, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, hash, null, role, active]
  );
  return r.insertId;
};

module.exports = {
  app, db, outbox, start, stop, seedUser,
  setMailFail: (v) => { failMail = v; },
  clearOutbox: () => { outbox.length = 0; },
  src,
};
