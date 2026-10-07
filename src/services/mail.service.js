/* Sends mail to the Ajobzio inbox through SMTP (Amazon SES). */
const nodemailer = require('nodemailer');
const { mail } = require('../config/env');

const transporter = nodemailer.createTransport({
  host: mail.host,
  port: mail.port,
  secure: mail.secure,
  requireTLS: mail.requireTLS,
  auth: { user: mail.user, pass: mail.pass }
});

function sendToInbox({ subject, text, html, replyTo }) {
  return transporter.sendMail({
    from: { name: 'Ajobzio', address: mail.from },
    to: mail.to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html
  });
}

module.exports = { sendToInbox };
