/**
 * test_email.js — checks your Gmail SMTP settings from backend/.env.
 *   node test_email.js                 → verifies login only
 *   node test_email.js you@example.com → also sends a test message there
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.EMAIL_USER || '';
const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

const problems = [];
if (!user || !pass) problems.push('EMAIL_USER and/or EMAIL_PASS are empty in backend/.env.');
if (/your|example|xxx/i.test(user)) problems.push(`EMAIL_USER ("${user}") still looks like a placeholder.`);
if (/your|example|xxx|password/i.test(pass)) problems.push('EMAIL_PASS still looks like a placeholder.');
if (pass && pass.length !== 16) problems.push(`EMAIL_PASS has ${pass.length} characters; a Gmail App Password is exactly 16 (spaces are ignored).`);
if (problems.length) { console.log('Config problems:\n - ' + problems.join('\n - ')); }

const hints = {
  EAUTH:        'Gmail rejected the login. Use a 16-character App Password (NOT your normal Gmail password) generated at Google Account → Security → 2-Step Verification → App passwords. 2-Step Verification must be ON, and EMAIL_USER must be the same Gmail account that created the App Password.',
  EDNS:         'This machine cannot resolve smtp.gmail.com — check your internet / DNS / VPN.',
  ENOTFOUND:    'This machine cannot resolve smtp.gmail.com — check your internet / DNS / VPN.',
  ETIMEDOUT:    'Connection to Gmail timed out — a firewall, VPN or network is blocking SMTP (ports 465/587).',
  ECONNECTION:  'Could not connect to Gmail — a firewall, VPN or network is blocking SMTP (ports 465/587).',
  ESOCKET:      'Network/TLS problem talking to Gmail (antivirus HTTPS scanning, proxy or firewall are common causes).',
};

(async () => {
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, connectionTimeout: 15000 });
  try {
    await t.verify();
    console.log('✅ Gmail SMTP login OK for', user);
  } catch (err) {
    console.log('❌ SMTP failed:', err.code || '', '-', err.message);
    console.log('   →', hints[err.code] || 'See the message above.');
    process.exit(1);
  }
  const to = process.argv[2];
  if (to) {
    try {
      await t.sendMail({ from: process.env.EMAIL_FROM || user, to, subject: 'DisasterRM test email', text: 'If you can read this, email sending works.' });
      console.log('✅ Test email sent to', to, '(check inbox and spam)');
    } catch (err) {
      console.log('❌ Send failed:', err.code || '', '-', err.message);
      process.exit(1);
    }
  }
})();