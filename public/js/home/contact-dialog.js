/* Last step of a quote: shows the summary, asks for contact details and sends it through the backend,
   or hands the same quote to WhatsApp. getRows() returns the summary rows; getPlaces() the checked places. */
import backend from '../backend/index.js';
import { config } from '../lib/config.js';

const PHONE = /^\+?[0-9\s-]{10,15}$/;

/* The quote as a ready-to-send WhatsApp message. */
function whatsappLink(rows, name, phone) {
  const lines = ['Hi Ajobzio, I\'d like a quote.', ''];
  if (name) lines.push('Name: ' + name);
  if (phone) lines.push('Phone: ' + phone);
  if (name || phone) lines.push('');
  rows.forEach(([label, value]) => lines.push(label + ': ' + value));
  return 'https://wa.me/' + config.phone + '?text=' + encodeURIComponent(lines.join('\n'));
}

export function createContactDialog({ getRows, getPlaces }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('contactDialog');
  const form = $('contactForm');
  const summary = $('contactSummary');
  const nameInput = $('contactName');
  const phoneInput = $('contactPhone');
  const emailInput = $('contactEmail');
  const websiteInput = $('contactWebsite');
  const status = $('contactStatus');
  const submitBtn = $('contactSubmit');
  const cancelBtn = $('contactCancel');

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'parcel-note contact-status ' + kind;
    status.hidden = !text;
  }

  function open() {
    summary.replaceChildren(...getRows().map(([label, value]) => {
      const item = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = label + ': ';
      item.append(name, value);
      return item;
    }));
    setStatus('', '');
    submitBtn.disabled = false;
    submitBtn.hidden = false;
    cancelBtn.textContent = 'Cancel';
    dialog.showModal();
    nameInput.focus();
  }

  /* The first problem with the contact details, focusing its field, or '' when valid. */
  function validate(name, phone, email) {
    if (!name) {
      nameInput.focus();
      return 'Please enter your full name.';
    }
    if (!PHONE.test(phone)) {
      phoneInput.focus();
      return 'Please enter a valid phone number.';
    }
    if (email && !emailInput.checkValidity()) {
      emailInput.focus();
      return 'Please enter a valid email address, or leave it empty.';
    }
    return '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const problem = validate(name, phone, email);
    if (problem) {
      setStatus(problem, 'error');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStatus('', '');
    try {
      const result = await backend.submitQuote({ name, phone, email, details: getRows(), places: getPlaces(), website: websiteInput.value });
      if (!result.ok) throw new Error(result.error || '');
      setStatus('Thanks, ' + name + '! Your quote request has been sent. We\'ll contact you shortly.', 'done');
      submitBtn.hidden = true;
      cancelBtn.textContent = 'Close';
      form.reset();
    } catch (error) {
      /* Show the server's reason (e.g. invalid phone); network failures get a generic message. */
      setStatus(error.message && !(error instanceof TypeError)
        ? error.message
        : 'We couldn\'t send your quote right now. Please try again in a moment.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Quote';
    }
  });
  $('contactWhatsapp').addEventListener('click', () => {
    window.open(whatsappLink(getRows(), nameInput.value.trim(), phoneInput.value.trim()), '_blank', 'noopener');
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return { open };
}
