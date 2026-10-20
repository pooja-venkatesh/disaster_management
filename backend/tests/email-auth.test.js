/**
 * Email verification + forgot/reset password — API tests.
 *
 * What is REAL here : Express routes, controllers, services, middleware, bcrypt,
 *                     crypto, JWTs, the SQL logic (run on SQLite).
 * What is MOCKED    : MySQL (SQLite stand-in), Gmail SMTP (mail is captured, not
 *                     delivered), DNS MX lookup.
 * => These tests prove the application logic. They do NOT prove real email
 *    delivery or MySQL-specific behaviour.
 */
const harness = require('./helpers/harness');
const test   = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { db, outbox, seedUser } = harness;
let base;
test.before(async () => { base = `http://127.0.0.1:${await harness.start()}`; });
test.after(async () => { await harness.stop(); });

const api = async (method, path, body, headers = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await r.json(); } catch { /* none */ }
  return { status: r.status, body: json };
};
const sql  = (q, p) => db.pool.query(q, p).then(([r]) => r);
const row  = async (q, p) => (await sql(q, p))[0];
const mailsTo = (to) => outbox.filter((m) => m.to === to);
const lastMail = (to, subjectPart) => [...mailsTo(to)].reverse().find((m) => !subjectPart || m.subject.includes(subjectPart));
const otpFrom  = (m) => m.html.match(/letter-spacing:\.45em[^>]*>(\d{6})</)[1];
const tokenFrom = (m) => m.html.match(/reset-password\?token=([a-f0-9]{64})/)[1];
const waitFor = async (fn, ms = 1500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 15)); } return fn(); };
let n = 0;
const uniq = (p = 'u') => `${p}${++n}@mail.test`;
const reg = (email, extra = {}) => api('POST', '/api/auth/register', { name: 'Test User', email, password: 'secret123', phone: '+911234567890', role: 'victim', ...extra });
const verify = (token, otp) => api('POST', '/api/auth/verify-email', { verificationToken: token, otp });
const resend = (token) => api('POST', '/api/auth/resend-verification', { verificationToken: token });
const ageOtp = (userId, col, secs) => sql(`UPDATE email_verification_otps SET ${col} = datetime('now', ?) WHERE user_id = ?`, [`-${secs} seconds`, userId]);
const uid = async (email) => (await row('SELECT user_id FROM users WHERE email = ?', [email])).user_id;

// ═══════════════ 1. Registration + OTP ═══════════════
test('register: creates UNVERIFIED account, returns no login token, emails a 6-digit OTP', async () => {
  const email = uniq();
  const r = await reg(email);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.requiresVerification, true);
  assert.equal(r.body.data.emailSent, true);
  assert.ok(r.body.data.verificationToken);
  assert.equal(r.body.data.token, undefined);
  assert.equal(r.body.data.user, undefined);
  const u = await row('SELECT * FROM users WHERE email = ?', [email]);
  assert.equal(u.email_verified, 0);
  const m = lastMail(email, 'verification code');
  assert.ok(m, 'verification email captured');
  assert.match(otpFrom(m), /^\d{6}$/);
});

test('OTP is stored only as an HMAC hash, with ~10 minute expiry', async () => {
  const email = uniq();
  await reg(email);
  const otp = otpFrom(lastMail(email));
  const rec = await row('SELECT *, CAST((strftime(\'%s\', expires_at) - strftime(\'%s\',\'now\')) AS INTEGER) AS ttl FROM email_verification_otps WHERE user_id = ?', [await uid(email)]);
  assert.match(rec.otp_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(rec.otp_hash, otp);
  assert.ok(!JSON.stringify(rec).includes(otp), 'plaintext OTP must not appear in the row');
  assert.ok(rec.ttl > 9 * 60 && rec.ttl <= 10 * 60, `ttl=${rec.ttl}`);
});

test('login BEFORE verification is refused (correct password), wrong password stays generic', async () => {
  const email = uniq();
  await reg(email);
  const ok = await api('POST', '/api/auth/login', { email, password: 'secret123' });
  assert.equal(ok.status, 403);
  assert.equal(ok.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(ok.body.data.token, undefined);
  const bad = await api('POST', '/api/auth/login', { email, password: 'wrongpass' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.message, 'Invalid email or password.');
});

test('an API token for an unverified user cannot reach protected routes', async () => {
  const email = uniq();
  await reg(email);
  const id = await uid(email);
  const forged = jwt.sign({ userId: id, role: 'victim' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const r = await api('GET', '/api/protected', undefined, { Authorization: `Bearer ${forged}` });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'EMAIL_NOT_VERIFIED');
});

test('incorrect OTP: rejected, attempts counted, account stays unverified', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const otp = otpFrom(lastMail(email));
  const wrong = otp === '000000' ? '111111' : '000000';
  const r = await verify(body.data.verificationToken, wrong);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'OTP_INVALID');
  assert.equal(r.body.data.attemptsLeft, 4);
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email])).v, 0);
  assert.equal((await row('SELECT attempts AS a FROM email_verification_otps WHERE user_id = ?', [await uid(email)])).a, 1);
});

test('malformed OTP input is rejected without consuming attempts', async () => {
  const { body } = await reg(uniq());
  for (const bad of ['12345', '1234567', 'abcdef', '', null, 123456, { $ne: 1 }, ['123456']]) {
    const r = await verify(body.data.verificationToken, bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.code, 'OTP_FORMAT');
  }
});

test('5 wrong attempts lock the code; even the correct OTP is then refused until resend', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  const otp = otpFrom(lastMail(email));
  const wrong = otp === '000000' ? '111111' : '000000';
  let last;
  for (let i = 0; i < 5; i++) last = await verify(tok, wrong);
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'OTP_TOO_MANY_ATTEMPTS');
  const correct = await verify(tok, otp);
  assert.equal(correct.status, 429);
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email])).v, 0);
  // fresh code (after cooldown) unlocks verification
  await ageOtp(await uid(email), 'last_sent_at', 120);
  assert.equal((await resend(tok)).status, 200);
  const fresh = otpFrom(lastMail(email));
  assert.equal((await verify(tok, fresh)).status, 200);
});

test('expired OTP is rejected (even if correct) and can be replaced via resend', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  const otp = otpFrom(lastMail(email));
  await ageOtp(await uid(email), 'expires_at', 1);
  const r = await verify(tok, otp);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'OTP_EXPIRED');
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email])).v, 0);
  await ageOtp(await uid(email), 'last_sent_at', 120);
  assert.equal((await resend(tok)).status, 200);
  assert.equal((await verify(tok, otpFrom(lastMail(email)))).status, 200);
});

test('correct OTP verifies the account, logs in, then login + protected routes work; OTP cannot be reused', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  const otp = otpFrom(lastMail(email));
  const r = await verify(tok, otp);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.token);
  assert.equal(r.body.data.user.email, email);
  assert.equal(r.body.data.user.email_verified, true);
  assert.equal(r.body.data.user.password_hash, undefined);
  const u = await row('SELECT * FROM users WHERE email = ?', [email]);
  assert.equal(u.email_verified, 1);
  assert.ok(u.email_verified_at);
  assert.ok(await waitFor(() => lastMail(email, 'Welcome')), 'welcome email sent after verification');

  const login = await api('POST', '/api/auth/login', { email, password: 'secret123' });
  assert.equal(login.status, 200);
  const prot = await api('GET', '/api/protected', undefined, { Authorization: `Bearer ${login.body.data.token}` });
  assert.equal(prot.status, 200);
  const prot2 = await api('GET', '/api/protected', undefined, { Authorization: `Bearer ${r.body.data.token}` });
  assert.equal(prot2.status, 200);

  const reuse = await verify(tok, otp);
  assert.equal(reuse.status, 400);
  assert.equal(reuse.body.code, 'ALREADY_VERIFIED');
  assert.equal(reuse.body.data, undefined);
  const rec = await row('SELECT consumed_at FROM email_verification_otps WHERE user_id = ?', [u.user_id]);
  assert.ok(rec.consumed_at, 'OTP marked consumed');
});

test('concurrent submissions of the same correct OTP: exactly one succeeds', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const otp = otpFrom(lastMail(email));
  const res = await Promise.all([1, 2, 3, 4].map(() => verify(body.data.verificationToken, otp)));
  assert.equal(res.filter((r) => r.status === 200).length, 1);
});

test('replacing the code invalidates the previous one', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  const first = otpFrom(lastMail(email));
  await ageOtp(await uid(email), 'last_sent_at', 120);
  await resend(tok);
  const second = otpFrom(lastMail(email));
  if (first !== second) {
    const r = await verify(tok, first);
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'OTP_INVALID');
  }
  assert.equal((await verify(tok, second)).status, 200);
});

// ═══════════════ 2. Resend rules & mail failure ═══════════════
test('resend: 60s cooldown enforced, hourly cap enforced', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  const early = await resend(tok);
  assert.equal(early.status, 429);
  assert.equal(early.body.code, 'RESEND_COOLDOWN');
  assert.ok(early.body.data.retryAfter > 0 && early.body.data.retryAfter <= 60);
  const id = await uid(email);
  let r;
  for (let i = 0; i < 4; i++) { await ageOtp(id, 'last_sent_at', 120); r = await resend(tok); assert.equal(r.status, 200, `send #${i + 2}`); }
  await ageOtp(id, 'last_sent_at', 120);
  r = await resend(tok);
  assert.equal(r.status, 429);
  assert.equal(r.body.code, 'RESEND_LIMIT');
});

test('mail failure at registration: account stays unverified, user is told, safe immediate resend works', async () => {
  const email = uniq();
  harness.setMailFail(true);
  const r = await reg(email);
  harness.setMailFail(false);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.emailSent, false);
  assert.match(r.body.message, /couldn't send/i);
  assert.equal(mailsTo(email).length, 0);
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email])).v, 0);
  // no cooldown penalty for a code that was never delivered
  const rs = await resend(r.body.data.verificationToken);
  assert.equal(rs.status, 200);
  const v = await verify(r.body.data.verificationToken, otpFrom(lastMail(email)));
  assert.equal(v.status, 200);
});

test('mail failure on resend: 502, nothing marked verified, retry immediately OK', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const tok = body.data.verificationToken;
  await ageOtp(await uid(email), 'last_sent_at', 120);
  harness.setMailFail(true);
  const bad = await resend(tok);
  harness.setMailFail(false);
  assert.equal(bad.status, 502);
  assert.equal(bad.body.code, 'EMAIL_SEND_FAILED');
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email])).v, 0);
  const ok = await resend(tok);
  assert.equal(ok.status, 200);
  assert.equal((await verify(tok, otpFrom(lastMail(email)))).status, 200);
});

// ═══════════════ 3. Bypass attempts ═══════════════
test('cannot bypass: forged/foreign/mismatched verification tokens and request-body tricks', async () => {
  const email = uniq();
  const { body } = await reg(email);
  const otp = otpFrom(lastMail(email));
  const id = await uid(email);

  // no token / garbage / random JWT / login-style JWT / token signed with the wrong purpose
  const login = jwt.sign({ userId: id, role: 'victim' }, process.env.JWT_SECRET);
  const wrongPurpose = jwt.sign({ uid: id, pf: 'x', purpose: 'other' }, process.env.JWT_SECRET);
  for (const t of [undefined, '', 'abc', login, wrongPurpose, { a: 1 }]) {
    const r = await verify(t, otp);
    assert.equal(r.status, 401, String(t));
    assert.equal(r.body.code, 'VERIFICATION_SESSION_INVALID');
  }
  assert.equal((await resend(login)).status, 401);

  // client cannot flip the flag via register or verify bodies
  const email2 = uniq();
  const r2 = await reg(email2, { email_verified: 1, emailVerified: true, is_active: 1 });
  assert.equal(r2.status, 201);
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email2])).v, 0);
  const r3 = await api('POST', '/api/auth/verify-email', { verificationToken: r2.body.data.verificationToken, otp: '000000', verified: true, email_verified: 1 });
  assert.equal(r3.status === 200, false);
  assert.equal((await row('SELECT email_verified AS v FROM users WHERE email = ?', [email2])).v, 0);
});

test('pre-hijack defence: someone who registers a victim\'s email cannot ride the victim\'s OTP', async () => {
  const victim = uniq('victim');
  const attacker = await reg(victim, { password: 'attacker-pass' });          // squats the address
  const otpInVictimsInbox = otpFrom(lastMail(victim));
  // victim only has the OTP, not the attacker's session token → cannot complete it
  const forged = jwt.sign({ uid: await uid(victim), pf: 'guess', purpose: 'email_verification' }, 'guess');
  assert.equal((await verify(forged, otpInVictimsInbox)).status, 401);
  // victim registers properly: credentials replaced, attacker's session dies
  const real = await reg(victim, { password: 'victim-pass1' });
  assert.equal(real.status, 201);
  assert.equal((await verify(attacker.body.data.verificationToken, otpFrom(lastMail(victim)))).status, 401);
  assert.equal((await verify(real.body.data.verificationToken, otpFrom(lastMail(victim)))).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email: victim, password: 'attacker-pass' })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { email: victim, password: 'victim-pass1' })).status, 200);
});

test('re-registering a VERIFIED email or an admin is refused; seeded/existing accounts keep working', async () => {
  const e = uniq();
  const first = await reg(e);
  await verify(first.body.data.verificationToken, otpFrom(lastMail(e)));
  assert.equal((await reg(e, { password: 'another-pw' })).status, 409);
  assert.equal((await api('POST', '/api/auth/login', { email: e, password: 'secret123' })).status, 200);

  await seedUser({ name: 'Admin', email: 'admin@mail.test', password: 'admin#123', role: 'admin' });
  assert.equal((await reg('admin@mail.test')).status, 409);
  const a = await api('POST', '/api/auth/login', { email: 'admin@mail.test', password: 'admin#123' });
  assert.equal(a.status, 200, 'pre-existing (default-verified) admin can still sign in');
  assert.equal(a.body.data.user.role, 'admin');
});

test('register validation unchanged (bad role / short password / bad email)', async () => {
  assert.equal((await reg(uniq(), { role: 'admin' })).status, 400);
  assert.equal((await reg(uniq(), { password: '123' })).status, 400);
  assert.equal((await reg('not-an-email')).status, 400);
  assert.equal((await reg(uniq(), { name: { x: 1 } })).status, 400);
});

// ═══════════════ 4. Forgot / reset password ═══════════════
const makeVerifiedUser = async (password = 'oldpass123') => {
  const email = uniq('v');
  await seedUser({ name: 'Verified Vic', email, password });
  return email;
};
const forgot = (email) => api('POST', '/api/auth/forgot-password', { email });
const reset  = (token, password, confirmPassword = password) => api('POST', '/api/auth/reset-password', { token, password, confirmPassword });

test('forgot-password: identical generic response for known and unknown emails', async () => {
  const known = await makeVerifiedUser();
  const a = await forgot(known);
  const b = await forgot('nobody-here@mail.test');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.status, b.status);
  await waitFor(() => lastMail(known, 'Reset'));
  assert.equal(mailsTo('nobody-here@mail.test').length, 0);
  assert.equal((await forgot('not-an-email')).status, 400);
});

test('reset email: real link to the React page, token never in API responses, only its hash stored, 15 min expiry', async () => {
  const email = await makeVerifiedUser();
  const resp = await forgot(email);
  assert.ok(!JSON.stringify(resp.body).match(/[a-f0-9]{64}/));
  const m = await waitFor(() => lastMail(email, 'Reset'));
  assert.ok(m);
  assert.match(m.html, /http:\/\/localhost:3000\/reset-password\?token=[a-f0-9]{64}/);
  assert.ok(!m.html.includes('oldpass123'), 'no password in email');
  const token = tokenFrom(m);
  const rec = await row('SELECT *, CAST((strftime(\'%s\', expires_at) - strftime(\'%s\',\'now\')) AS INTEGER) AS ttl FROM password_reset_tokens WHERE user_id = ?', [await uid(email)]);
  assert.equal(rec.token_hash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.notEqual(rec.token_hash, token);
  assert.ok(rec.ttl > 14 * 60 && rec.ttl <= 15 * 60, `ttl=${rec.ttl}`);
});

test('forgot-password is not sent for unverified or deactivated accounts (still generic 200)', async () => {
  const pending = uniq('pend');
  await reg(pending);
  const inactive = uniq('off');
  await seedUser({ name: 'Off', email: inactive, password: 'xxxxxx', active: 0 });
  for (const e of [pending, inactive]) { assert.equal((await forgot(e)).status, 200); }
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(mailsTo(pending).filter((m) => m.subject.includes('Reset')).length, 0);
  assert.equal(mailsTo(inactive).length, 0);
});

test('reset flow: validate → mismatch/short rejected → success → new password works, old does not', async () => {
  const email = await makeVerifiedUser('oldpass123');
  await forgot(email);
  const token = tokenFrom(await waitFor(() => lastMail(email, 'Reset')));

  assert.equal((await api('POST', '/api/auth/reset-password/validate', { token })).status, 200);
  assert.equal((await reset(token, 'newpass456', 'different')).status, 400);
  assert.equal((await reset(token, '123')).status, 400);
  assert.equal((await reset(token, 'x'.repeat(73))).status, 400);
  assert.equal((await api('POST', '/api/auth/reset-password', { token, password: 'newpass456' })).status, 400);

  const ok = await reset(token, 'newpass456');
  assert.equal(ok.status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'newpass456' })).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'oldpass123' })).status, 401);
  const u = await row('SELECT password_hash FROM users WHERE email = ?', [email]);
  assert.match(u.password_hash, /^\$2[aby]\$/);
  assert.ok(await bcrypt.compare('newpass456', u.password_hash));
  assert.ok(await waitFor(() => lastMail(email, 'password was changed')), 'confirmation email sent');
});

test('reset token is single-use', async () => {
  const email = await makeVerifiedUser();
  await forgot(email);
  const token = tokenFrom(await waitFor(() => lastMail(email, 'Reset')));
  assert.equal((await reset(token, 'firstnew1')).status, 200);
  const again = await reset(token, 'secondnew2');
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'RESET_TOKEN_INVALID');
  assert.equal((await api('POST', '/api/auth/reset-password/validate', { token })).status, 400);
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'firstnew1' })).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'secondnew2' })).status, 401);
});

test('reset token: expired, unknown, malformed and tampered values are rejected', async () => {
  const email = await makeVerifiedUser();
  await forgot(email);
  const token = tokenFrom(await waitFor(() => lastMail(email, 'Reset')));
  await sql(`UPDATE password_reset_tokens SET expires_at = datetime('now','-1 seconds') WHERE user_id = ?`, [await uid(email)]);
  for (const t of [token, crypto.randomBytes(32).toString('hex'), 'short', '', undefined, null, { $ne: 1 }, token.toUpperCase(), token + 'a']) {
    const v = await api('POST', '/api/auth/reset-password/validate', { token: t });
    assert.equal(v.status, 400, String(t));
    const r = await reset(t, 'newpass456');
    assert.equal(r.status, 400, String(t));
    assert.equal(r.body.code, 'RESET_TOKEN_INVALID');
  }
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'newpass456' })).status, 401);
});

test('requesting a new link invalidates the previous one; cooldown suppresses rapid repeats', async () => {
  const email = await makeVerifiedUser();
  await forgot(email);
  const t1 = tokenFrom(await waitFor(() => lastMail(email, 'Reset')));
  await forgot(email);                                 // within cooldown → silently no new mail
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(mailsTo(email).filter((m) => m.subject.includes('Reset')).length, 1);
  await sql(`UPDATE password_reset_tokens SET created_at = datetime('now','-120 seconds') WHERE user_id = ?`, [await uid(email)]);
  await forgot(email);
  await waitFor(() => mailsTo(email).filter((m) => m.subject.includes('Reset')).length === 2);
  const t2 = tokenFrom(lastMail(email, 'Reset'));
  assert.notEqual(t1, t2);
  assert.equal((await reset(t1, 'newpass456')).status, 400, 'old link dead');
  assert.equal((await reset(t2, 'newpass456')).status, 200);
});

test('reset mail failure: still generic 200, token discarded, user can retry immediately', async () => {
  const email = await makeVerifiedUser();
  harness.setMailFail(true);
  const r = await forgot(email);
  assert.equal(r.status, 200);
  await new Promise((x) => setTimeout(x, 200));
  harness.setMailFail(false);
  assert.equal((await row('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ?', [await uid(email)])).n, 0);
  await forgot(email);
  assert.ok(await waitFor(() => lastMail(email, 'Reset')));
});

test('a successful reset leaves existing verified state and admin accounts intact', async () => {
  const email = await makeVerifiedUser();
  await forgot(email);
  await reset(tokenFrom(await waitFor(() => lastMail(email, 'Reset'))), 'brandnew99');
  const u = await row('SELECT email_verified AS v, is_active AS a FROM users WHERE email = ?', [email]);
  assert.equal(u.v, 1); assert.equal(u.a, 1);
});
