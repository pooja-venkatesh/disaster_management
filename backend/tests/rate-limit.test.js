/** Per-IP limiter on the real routes (uses the real rateLimiter middleware). */
process.env.TEST_REAL_RATE_LIMITER = '1';
const harness = require('./helpers/harness');
const test   = require('node:test');
const assert = require('node:assert/strict');
let base;
test.before(async () => { base = `http://127.0.0.1:${await harness.start()}`; });
test.after(async () => { await harness.stop(); });

test('forgot-password is rate limited per IP (11th request in the window → 429 + Retry-After)', async () => {
  let last;
  for (let i = 0; i < 11; i++) {
    last = await fetch(`${base}/api/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@mail.test' }) });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  assert.equal((await last.json()).code, 'RATE_LIMITED');
});

test('verify-email is rate limited per IP', async () => {
  let last;
  for (let i = 0; i < 31; i++) {
    last = await fetch(`${base}/api/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verificationToken: 'x', otp: '123456' }) });
  }
  assert.equal(last.status, 429);
});
