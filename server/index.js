require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO = 'support@ajobzio.com',
  CORS_ORIGIN = '*'
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
  console.warn(
    '[warn] Missing SMTP env vars. Copy .env.example to .env and fill in SES credentials.'
  );
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((s) => s.trim())
  })
);
app.use(express.json({ limit: '32kb' }));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEnquiryHtml({ name, email, reason }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeReason = escapeHtml(reason).replace(/\r?\n/g, '<br>');
  const when = new Date().toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#1e3a8a);padding:28px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8);font-weight:700;">Ajobzio Support</p>
              <h1 style="margin:0;font-size:24px;color:#fff;font-weight:800;">New website enquiry</h1>
              <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Submitted from the Ajobzio enquire form</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Name</p>
                    <p style="margin:0;font-size:16px;font-weight:700;">${safeName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Email</p>
                    <p style="margin:0;font-size:16px;font-weight:700;">
                      <a href="mailto:${safeEmail}" style="color:#1e3a8a;text-decoration:none;">${safeEmail}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Question</p>
                    <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${safeReason}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-size:13px;color:#64748b;">Received: <strong>${escapeHtml(when)}</strong></p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#0f766e,#1e3a8a);">
                    <a href="mailto:${safeEmail}?subject=${encodeURIComponent('Re: Your Ajobzio enquiry')}" style="display:inline-block;padding:12px 20px;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">Reply to ${safeName}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">Find work. Earn daily. — ajobzio.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/enquire', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const reason = String(req.body?.reason || req.body?.message || '').trim();

    if (!name || !email || !reason) {
      return res.status(400).json({ ok: false, error: 'Name, email, and question are required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email address.' });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
      return res.status(500).json({ ok: false, error: 'Email server is not configured.' });
    }

    const html = buildEnquiryHtml({ name, email, reason });
    const text = `New Ajobzio Enquiry\n\nName: ${name}\nEmail: ${email}\n\nQuestion:\n${reason}\n`;

    await transporter.sendMail({
      from: `"Ajobzio Website" <${MAIL_FROM}>`,
      to: MAIL_TO,
      replyTo: email,
      subject: `New Enquiry from ${name} | Ajobzio`,
      text,
      html
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Enquire email failed:', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to send email.' });
  }
});

app.listen(PORT, () => {
  console.log(`Ajobzio enquire API listening on http://localhost:${PORT}`);
});
