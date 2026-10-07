/* Helpers for reading untrusted request input. */

const PATTERNS = {
  placeId: /^[A-Za-z0-9_-]{10,300}$/,
  sessionToken: /^[A-Za-z0-9-]{1,64}$/,
  orderId: /^[A-Z0-9-]{4,30}$/,
  phone: /^\+?[0-9\s-]{10,15}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

/* A trimmed string of at most max characters; anything else becomes ''. */
function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/* Keeps header-bound values on one line. */
function oneLine(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

/* A finite number inside [min, max], or null. */
function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

module.exports = { PATTERNS, text, oneLine, coordinate, escapeHtml };
