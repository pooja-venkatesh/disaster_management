/**
 * emailService.js
 * Sends transactional emails via Gmail SMTP using Nodemailer.
 * Set EMAIL_USER and EMAIL_PASS (Gmail App Password) in .env
 */

const nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || `DisasterRM <${process.env.EMAIL_USER}>`;

// ── Base HTML wrapper ────────────────────────────────────────────────
const html = (title, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f4f5f7;margin:0;padding:0}
    .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:#EF3333;padding:28px 32px}
    .header h1{color:#fff;margin:0;font-size:1.3rem;letter-spacing:-0.02em}
    .header p{color:rgba(255,255,255,.8);margin:4px 0 0;font-size:.85rem}
    .body{padding:28px 32px}
    .body p{color:#374151;font-size:.9rem;line-height:1.7;margin:0 0 14px}
    .badge{display:inline-block;background:#fff0f0;color:#EF3333;border:1px solid #fecaca;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700}
    .btn{display:inline-block;background:#EF3333;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.9rem;margin:8px 0 16px}
    .divider{border:none;border-top:1px solid #f3f4f6;margin:18px 0}
    .footer{padding:16px 32px 24px;color:#9ca3af;font-size:.76rem;line-height:1.6}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>DisasterRM</h1>
      <p>Disaster Resource Management System</p>
    </div>
    <div class="body">
      <h2 style="margin:0 0 16px;color:#111827;font-size:1.1rem">${title}</h2>
      ${body}
    </div>
    <div class="footer">
      This is an automated message from DisasterRM. Please do not reply to this email.<br/>
      &copy; ${new Date().getFullYear()} Disaster Resource Management System
    </div>
  </div>
</body>
</html>`;

// ── Send helper ──────────────────────────────────────────────────────
const send = async ({ to, subject, htmlBody }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[Email] Skipped (EMAIL_USER/PASS not set):', subject, '→', to);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html: htmlBody });
    console.log('[Email] Sent:', subject, '→', to);
  } catch (err) {
    console.error('[Email] Failed:', err.message);
  }
};

// ── Strict send (auth flows) ─────────────────────────────────────────
// Unlike send() above (fire-and-forget, errors swallowed — used by the
// SOS/rescue notifications), this REJECTS when the email cannot be sent so
// the caller can tell the user and never pretend a code/link was delivered.
const sendStrict = async ({ to, subject, htmlBody }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const err = new Error('Email service is not configured (EMAIL_USER / EMAIL_PASS missing).');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  await transporter.sendMail({ from: FROM, to, subject, html: htmlBody });
  console.log('[Email] Sent:', subject, '→', to);
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Test hook only: lets automated tests capture outgoing mail.
exports.__setTransporterForTests = (t) => { transporter = t; };

// ── Templates ────────────────────────────────────────────────────────

exports.sendWelcome = ({ to, name, role }) =>
  send({
    to, subject: 'Welcome to DisasterRM',
    htmlBody: html('Welcome to DisasterRM', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account has been created successfully as a <span class="badge">${role}</span>.</p>
      ${role === 'shelter' ? `<p>An administrator will verify your shelter profile before you start receiving emergency requests. You will be notified once verified.</p>` : ''}
      ${role === 'victim'  ? `<p>You can now submit emergency requests and track them in real time on your dashboard.</p>` : ''}
      <hr class="divider"/>
      <p>If you did not create this account, please ignore this email.</p>
    `),
  });

exports.sendRequestConfirmation = ({ to, name, requestId, type, title }) =>
  send({
    to, subject: `Request #${requestId} Submitted — DisasterRM`,
    htmlBody: html('Emergency Request Submitted', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your emergency request has been received and we are finding the nearest available shelter.</p>
      <p><strong>Request ID:</strong> #${requestId}<br/>
         <strong>Type:</strong> ${type}<br/>
         <strong>Title:</strong> ${title}</p>
      <p>You will be notified by email and in-app as soon as a shelter responds.</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">Track your request live on your dashboard.</p>
    `),
  });

exports.sendRequestAccepted = ({ to, name, requestId, title, shelterName, shelterAddress }) =>
  send({
    to, subject: `Your Request Has Been Accepted — DisasterRM`,
    htmlBody: html('Request Accepted', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Great news! Your emergency request has been accepted by a shelter.</p>
      <p><strong>Request:</strong> ${title} (#${requestId})<br/>
         <strong>Shelter:</strong> ${shelterName}<br/>
         ${shelterAddress ? `<strong>Address:</strong> ${shelterAddress}` : ''}</p>
      <p>The shelter is now responsible for your request. Please make your way to the shelter or wait for their assistance.</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">Track real-time updates on your dashboard.</p>
    `),
  });

exports.sendRequestFulfilled = ({ to, name, requestId, title }) =>
  send({
    to, subject: `Request Fulfilled — DisasterRM`,
    htmlBody: html('Request Fulfilled', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your emergency request <strong>${title}</strong> (#${requestId}) has been marked as <strong>fulfilled</strong>.</p>
      <p>We hope you received the help you needed. Stay safe.</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">You can submit a new request anytime from your dashboard.</p>
    `),
  });

exports.sendRequestUnresolved = ({ to, name, requestId, title }) =>
  send({
    to, subject: `Emergency Escalated to Authorities — DisasterRM`,
    htmlBody: html('Emergency Escalated', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your request <strong>${title}</strong> (#${requestId}) could not be fulfilled by nearby shelters.</p>
      <p>It has been <strong>escalated to the government administration</strong> who will intervene directly. You will be contacted as soon as possible.</p>
      <hr class="divider"/>
      <p style="color:#EF3333;font-size:.85rem;font-weight:600">If this is a life-threatening emergency, please also contact local emergency services (112).</p>
    `),
  });

exports.sendShelterVerified = ({ to, name, shelterName }) =>
  send({
    to, subject: `Shelter Verified — DisasterRM`,
    htmlBody: html('Shelter Verified', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your shelter <strong>${shelterName}</strong> has been verified by the administration.</p>
      <p>You will now start receiving emergency request assignments. Log in to your dashboard to manage incoming requests.</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">Make sure your capacity and resource types are up to date in your profile.</p>
    `),
  });

exports.sendAdminResolved = ({ to, name, requestId, title, notes }) =>
  send({
    to, subject: `Request Resolved by Administration — DisasterRM`,
    htmlBody: html('Resolved by Administration', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your emergency request <strong>${title}</strong> (#${requestId}) has been resolved directly by the government administration.</p>
      ${notes ? `<p><strong>Notes from administration:</strong><br/>${notes}</p>` : ''}
      <p>We hope you received the help you needed. Stay safe.</p>
    `),
  });

// ── Auth: email verification & password reset ────────────────────────

/** Rejects if the email could not be sent. */
exports.sendVerificationOtp = ({ to, name, otp, ttlMinutes = 10 }) =>
  sendStrict({
    to, subject: 'Your DisasterRM verification code',
    htmlBody: html('Verify your email address', `
      <p>Hi <strong>${esc(name)}</strong>,</p>
      <p>Use this code to verify your email and finish creating your account:</p>
      <p style="text-align:center;margin:20px 0">
        <span style="display:inline-block;font-size:2rem;font-weight:800;letter-spacing:.45em;padding:12px 12px 12px 22px;background:#fff0f0;color:#EF3333;border:1px solid #fecaca;border-radius:10px;font-family:'Courier New',monospace">${esc(otp)}</span>
      </p>
      <p>This code expires in <strong>${ttlMinutes} minutes</strong> and can only be used once.</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">If you did not try to register, you can safely ignore this email. Never share this code with anyone.</p>
    `),
  });

/** Rejects if the email could not be sent. */
exports.sendPasswordReset = ({ to, name, resetUrl, ttlMinutes = 15 }) =>
  sendStrict({
    to, subject: 'Reset your DisasterRM password',
    htmlBody: html('Reset your password', `
      <p>Hi <strong>${esc(name)}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <p><a class="btn" href="${esc(resetUrl)}">Reset password</a></p>
      <p>This link expires in <strong>${ttlMinutes} minutes</strong> and can only be used once.</p>
      <p style="color:#6b7280;font-size:.82rem;word-break:break-all">If the button doesn't work, copy this link into your browser:<br/>${esc(resetUrl)}</p>
      <hr class="divider"/>
      <p style="color:#6b7280;font-size:.82rem">If you did not request this, you can safely ignore this email — your password will not change.</p>
    `),
  });

/** Best-effort notification (does not throw). */
exports.sendPasswordChanged = ({ to, name }) =>
  send({
    to, subject: 'Your DisasterRM password was changed',
    htmlBody: html('Password changed', `
      <p>Hi <strong>${esc(name)}</strong>,</p>
      <p>Your password was just changed. You can now sign in with your new password.</p>
      <hr class="divider"/>
      <p style="color:#EF3333;font-size:.85rem;font-weight:600">If this wasn't you, reset your password again immediately and contact the administrator.</p>
    `),
  });
