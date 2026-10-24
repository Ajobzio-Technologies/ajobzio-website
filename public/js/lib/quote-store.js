/* Remembers things in this browser so customers can come back without an account:
   the quote carried from the home page form to the /quote confirmation page (kept for a week,
   so closing the tab doesn't lose it), and their own contact details for the next quote.
   Nothing here reaches the server until the customer sends a quote. */
const KEY = 'ajobzio.quote';
const CONTACT_KEY = 'ajobzio.contact';
const QUOTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    /* Nothing to clear. */
  }
}

export function saveQuote(quote) {
  return write(KEY, { ...quote, savedAt: Date.now() });
}

/* The saved quote, or null when there isn't one, it's over a week old (or storage is blocked). */
export function loadQuote() {
  const quote = read(KEY);
  if (!quote || !Array.isArray(quote.rows) || !Array.isArray(quote.places)) return null;
  if (!(Date.now() - quote.savedAt < QUOTE_MAX_AGE_MS)) {
    remove(KEY);
    return null;
  }
  return quote;
}

export function clearQuote() {
  remove(KEY);
}

/* The customer's own { name, phone, email }, to fill in the next quote. */
export function saveContact(contact) {
  write(CONTACT_KEY, { name: contact.name || '', phone: contact.phone || '', email: contact.email || '' });
}

export function loadContact() {
  const contact = read(CONTACT_KEY);
  return contact && typeof contact === 'object' ? contact : null;
}

export function clearContact() {
  remove(CONTACT_KEY);
}
