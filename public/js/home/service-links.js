/* Links like /#local-services (the footer's Services column) open the hero quote form
   in the matching mode, with the service filled in where there is one. */
const SERVICE_LINKS = {
  'parcel-delivery': { mode: 'parcel' },
  'local-services': { mode: 'service' },
  'home-cleaning': { mode: 'service', need: 'Home cleaning' },
  repairs: { mode: 'service', need: 'Repairs' }
};
/* Matches the hero's mode-switch transition (hero-mode.js). */
const MODE_SWITCH_MS = 320;

export function initServiceLinks({ switchMode, fields }) {
  const hero = document.getElementById('hero');

  function apply() {
    const link = SERVICE_LINKS[location.hash.slice(1)];
    if (!link) return;
    switchMode(link.mode);
    hero.scrollIntoView({ behavior: 'smooth' });
    if (link.need) {
      setTimeout(() => {
        fields.serviceNeed.value = link.need;
        fields.serviceNeed.dispatchEvent(new Event('input', { bubbles: true }));
      }, MODE_SWITCH_MS);
    }
  }

  window.addEventListener('hashchange', apply);
  /* Clicking the link that is already in the address bar doesn't fire hashchange, so run it directly. */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/#"]');
    if (!link || link.getAttribute('href') !== '/' + location.hash || !SERVICE_LINKS[location.hash.slice(1)]) return;
    event.preventDefault();
    apply();
  });
  apply();
}
