/* Bottom "What needs doing today?" search: hands off to the hero quote form. */
const PARCEL_WORDS = /courier|parcel|deliver|send|van|move|moving/i;
const MODE_SWITCH_MS = 320;

export function initCtaSearch({ switchMode, fields }) {
  const form = document.getElementById('ctaForm');
  const need = document.getElementById('ctaNeed');
  const area = document.getElementById('ctaArea');
  if (!form) return;

  document.querySelectorAll('.cta-popular button').forEach((chip) => {
    chip.addEventListener('click', () => {
      need.value = chip.textContent;
      area.focus();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = need.value.trim();
    const place = area.value.trim();
    const parcel = PARCEL_WORDS.test(text);
    switchMode(parcel ? 'parcel' : 'service');
    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
    /* Wait for the mode switch, then prefill and let the place search suggest matches. */
    setTimeout(() => {
      const target = parcel ? fields.fromInput : fields.serviceArea;
      if (!parcel && text) {
        fields.serviceNeed.value = text;
        fields.serviceNeed.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (place) {
        target.value = place;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      target.focus({ preventScroll: true });
    }, MODE_SWITCH_MS);
  });
}
