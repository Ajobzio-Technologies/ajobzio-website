/* The team's quote and payment emails as branded HTML (with a plain-text copy).
   Email clients ignore <style> blocks and modern CSS, so the layout is tables with inline styles. */
const { escapeHtml, oneLine } = require('../utils/input');

const C = {
  ink: '#082D36',
  nav: '#173F48',
  muted: '#6D8386',
  line: '#E4EDEA',
  bg: '#F3F7F6',
  blue: '#1666D8',
  green: '#0E9B86',
  navy: '#0B3B5C'
};
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const esc = (value) => escapeHtml(String(value));

function money(value) {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function button(href, label, color) {
  return '<a href="' + esc(href) + '" style="display:inline-block;padding:7px 12px;margin:6px 6px 0 0;border-radius:8px;background:' +
    (color || C.blue) + ';color:#ffffff;font-size:12px;font-weight:700;text-decoration:none">' + esc(label) + '</a>';
}

function badge(text, background, color) {
  return '<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:' + background + ';color:' + color +
    ';font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">' + esc(text) + '</span>';
}

/* A white card with a small uppercase heading. */
function section(title, body) {
  return '<tr><td style="padding:0 24px 16px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ' + C.line + ';border-radius:14px">' +
    '<tr><td style="padding:18px 20px">' +
    '<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + C.muted + '">' + esc(title) + '</p>' +
    body + '</td></tr></table></td></tr>';
}

/* Label/value rows; values are escaped unless already HTML (html: true). */
function rows(list) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + list.map(([label, value, html]) => (
    '<tr><td style="padding:5px 12px 5px 0;font-size:13px;color:' + C.muted + ';vertical-align:top;width:38%">' + esc(label) + '</td>' +
    '<td style="padding:5px 0;font-size:14px;font-weight:600;color:' + C.ink + ';vertical-align:top">' + (html ? value : esc(value)) + '</td></tr>'
  )).join('') + '</table>';
}

/* Header band with the wordmark, a title and the order ID. */
function header(title, orderId, tag) {
  return '<tr><td style="padding:24px 24px 0">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.navy + ';background-image:linear-gradient(135deg,' + C.navy + ',#0E5A7A);border-radius:16px">' +
    '<tr><td style="padding:22px 24px">' +
    '<p style="margin:0;font-size:20px;font-weight:800;letter-spacing:0.02em;color:#ffffff">AJOBZIO <span style="font-style:italic;font-weight:600;color:#2BE0C4">Services</span></p>' +
    '<p style="margin:14px 0 0;font-size:24px;font-weight:800;color:#ffffff">' + esc(title) + '</p>' +
    '<p style="margin:6px 0 0;font-size:13px;color:#BFD6E0">Order ID <b style="color:#ffffff;letter-spacing:0.03em">' + esc(orderId) + '</b>' +
    (tag ? ' &nbsp;' + tag : '') + '</p>' +
    '</td></tr></table></td></tr>';
}

function layout(preheader, inner) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + C.bg + '">' +
    '<span style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) + '</span>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.bg + ';' + FONT + '">' +
    '<tr><td align="center" style="padding:16px 8px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px">' + inner +
    '<tr><td style="padding:4px 24px 24px;font-size:12px;color:' + C.muted + ';text-align:center">Sent by the Ajobzio website · ajobzio.com</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function paymentTag(payment) {
  if (payment.method === 'now') return badge('Pay now · awaiting payment', '#FFF0D9', '#8A5A12');
  return badge('Pay later', '#E7F0FE', C.blue);
}

/* Name, tap-to-call phone and email rows for one person: { name, phone, email }. */
function personRows(person) {
  return rows([
    ['Name', person.name],
    ['Phone', '<a href="tel:' + esc(person.phone.replace(/[^\d+]/g, '')) + '" style="color:' + C.blue + ';text-decoration:none">' + esc(person.phone) + '</a>', true],
    ['Email', person.email
      ? '<a href="mailto:' + esc(person.email) + '" style="color:' + C.blue + ';text-decoration:none">' + esc(person.email) + '</a>'
      : '<span style="color:' + C.muted + ';font-weight:400">Not provided</span>', true]
  ]);
}

function personText(title, person) {
  return [title, 'Name: ' + person.name, 'Phone: ' + person.phone, 'Email: ' + (person.email || 'Not provided')];
}

/* quote: { orderId, name, phone, email, receiver, request, requestRows, locations, routeLink, trip, bill, payment }.
   name/phone/email are the customer (the pickup contact for a parcel); receiver is the delivery contact or null. */
function quoteEmail(quote) {
  const sections = [];
  const sender = { name: quote.name, phone: quote.phone, email: quote.email };

  sections.push(section(quote.receiver ? 'Pickup contact (customer)' : 'Customer', personRows(sender)));
  if (quote.receiver) sections.push(section('Delivery contact', personRows(quote.receiver)));

  if (quote.locations.length) {
    const stops = quote.locations.map((place, i) => {
      const dot = place.label === 'Delivery' ? C.blue : C.green;
      const letter = quote.locations.length > 1 ? String.fromCharCode(65 + i) : '•';
      return '<tr><td style="width:34px;vertical-align:top;padding:6px 0">' +
        '<div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:' + dot + ';color:#ffffff;font-size:12px;font-weight:700;text-align:center">' + letter + '</div></td>' +
        '<td style="padding:6px 0 10px">' +
        '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + C.muted + '">' + esc(place.label) +
        (place.district ? ' · ' + esc(place.district) : '') + '</p>' +
        '<p style="margin:3px 0 0;font-size:14px;font-weight:600;line-height:1.45;color:' + C.ink + '">' + esc(place.address) + '</p>' +
        button(place.mapLink, 'Open in Maps') + (place.pinLink ? button(place.pinLink, 'Customer’s pin', C.green) : '') +
        '</td></tr>';
    }).join('');
    let trip = '';
    if (quote.trip) {
      trip = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:' + C.bg + ';border-radius:10px"><tr>' +
        '<td style="padding:12px 14px;font-size:12px;color:' + C.muted + '">Distance<br><b style="font-size:16px;color:' + C.ink + '">' +
        (quote.trip.approximate ? '≈ ' : '') + esc(quote.trip.km) + ' km</b></td>' +
        '<td style="padding:12px 14px;font-size:12px;color:' + C.muted + '">Travel time<br><b style="font-size:16px;color:' + C.ink + '">' +
        esc(quote.trip.duration || 'Not available') + '</b></td>' +
        (quote.routeLink ? '<td align="right" style="padding:12px 14px">' + button(quote.routeLink, 'Directions', C.navy) + '</td>' : '') +
        '</tr></table>';
    }
    sections.push(section(quote.locations.length > 1 ? 'Route' : 'Location', '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + stops + '</table>' + trip));
  }

  if (quote.requestRows.length) sections.push(section(quote.request + ' details', rows(quote.requestRows)));

  if (quote.bill) {
    const bill = quote.bill;
    const line = (label, value, strong) => '<tr><td style="padding:7px 0;font-size:14px;color:' + (strong ? C.ink : C.nav) + ';' + (strong ? 'font-weight:700;' : '') + '">' + esc(label) + '</td>' +
      '<td align="right" style="padding:7px 0;font-size:14px;font-weight:' + (strong ? 700 : 600) + ';color:' + C.ink + '">' + esc(value) + '</td></tr>';
    const rule = '<tr><td colspan="2" style="border-top:1px solid ' + C.line + ';font-size:0;line-height:0;padding:3px 0 0">&nbsp;</td></tr>';
    let body = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      line('Base fare (first ' + bill.includedKm + ' km)', money(bill.baseFare)) +
      line('Distance charge (' + bill.extraKm + ' km × ' + money(bill.perKm) + '/km)', money(bill.distanceCharge)) +
      (bill.discount ? line('Discount (' + bill.discountPercent + '%)', '−' + money(bill.discount)) : '') + rule +
      line('Subtotal', money(bill.subtotal), true) +
      line('CGST @ ' + bill.gstPercent / 2 + '%', money(bill.cgst)) +
      line('SGST @ ' + bill.gstPercent / 2 + '%', money(bill.sgst));
    if (bill.roundOff) body += line('Round off', (bill.roundOff > 0 ? '+' : '−') + money(Math.abs(bill.roundOff)));
    body += '</table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:' + C.navy + ';border-radius:12px"><tr>' +
      '<td style="padding:14px 16px;font-size:15px;font-weight:700;color:#ffffff">Total payable<br><span style="font-size:11px;font-weight:400;color:#BFD6E0">Inclusive of ' + bill.gstPercent + '% GST' +
      (quote.trip && quote.trip.approximate ? ' · approximate distance' : '') + '</span></td>' +
      '<td align="right" style="padding:14px 16px;font-size:24px;font-weight:800;color:#ffffff;white-space:nowrap">' + esc(money(bill.total)) + '</td></tr></table>';
    sections.push(section('Billing summary', body));
  }

  const pay = [['Method', quote.payment.method === 'now' ? 'Pay now (online)' : 'Pay later']];
  pay.push(['Status', quote.payment.method === 'now' ? 'Awaiting payment' : 'To be collected after confirmation']);
  if (quote.payment.paymentId) pay.push(['Payment ID', quote.payment.paymentId]);
  sections.push(section('Payment', rows(pay) + (quote.payment.paymentUrl ? button(quote.payment.paymentUrl, 'View payment page', C.navy) : '')));

  const total = quote.bill ? ' · ' + money(quote.bill.total) : '';
  return {
    replyTo: quote.email,
    subject: oneLine('New quote ' + quote.orderId + ': ' + quote.request + ' from ' + quote.name + total),
    text: [
      'New quote ' + quote.orderId,
      '',
      ...personText(quote.receiver ? 'Pickup contact (customer)' : 'Customer', sender),
      '',
      ...(quote.receiver ? [...personText('Delivery contact', quote.receiver), ''] : []),
      'Quote details',
      ...quote.details.map(([label, value]) => label + ': ' + value)
    ].join('\n'),
    html: layout(quote.request + ' quote from ' + quote.name + total,
      header('New ' + quote.request.toLowerCase() + ' quote', quote.orderId, paymentTag(quote.payment)) +
      '<tr><td style="height:16px;font-size:0;line-height:0">&nbsp;</td></tr>' + sections.join(''))
  };
}

/* order: { orderId, name, phone, total, paymentId }. */
function paymentReceivedEmail(order) {
  const list = [['Name', order.name], ['Phone', order.phone], ['Amount paid', money(order.total)], ['Payment ID', order.paymentId]];
  return {
    subject: oneLine('Payment received: ' + order.orderId + ' from ' + order.name + ' · ' + money(order.total)),
    text: ['Payment received', 'Order ID: ' + order.orderId, ...list.map(([label, value]) => label + ': ' + value)].join('\n'),
    html: layout('Payment of ' + money(order.total) + ' received for ' + order.orderId,
      header('Payment received', order.orderId, badge('Paid', '#DDF7EF', C.green)) +
      '<tr><td style="height:16px;font-size:0;line-height:0">&nbsp;</td></tr>' +
      section('Payment', rows(list)))
  };
}

module.exports = { quoteEmail, paymentReceivedEmail, money };
