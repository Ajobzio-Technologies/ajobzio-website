/* The Parcel delivery / Local service switch at the top of the hero.
   The background and tabs change at once; the copy and form swap after the grid fades out. */
const HERO_COPY = {
  parcel: {
    badge: 'Parcel delivery, made simple',
    title: 'Send it. Track it. Get it delivered.',
    lede: 'Compare trusted local delivery partners, choose the right vehicle for your parcel, and see clear pricing — all in minutes.',
    checks: ['No account required', 'Clear pricing', 'Reliable delivery']
  },
  service: {
    badge: 'Local help, ready when you are',
    title: 'Book help. Get it done.',
    lede: 'Find trusted local professionals nearby — clear prices, flexible timing, no account required.',
    checks: ['No account needed', 'Free instant quotes', 'Verified providers']
  }
};
const SWITCH_MS = 220;

/* onChange(mode) runs once the copy has swapped, so the form can switch too. */
export function initHeroMode({ onChange }) {
  const hero = document.getElementById('hero');
  const heroGrid = document.getElementById('heroGrid');
  const heroBadge = document.getElementById('heroBadge');
  const heroTitle = document.getElementById('heroTitle');
  const heroLede = document.getElementById('heroLede');
  const buttons = document.querySelectorAll('.modes button');
  let current = 'parcel';
  let timer = null;

  function showMode(mode) {
    hero.classList.toggle('mode-parcel', mode === 'parcel');
    hero.classList.toggle('mode-service', mode !== 'parcel');
    buttons.forEach((item) => {
      const on = item.dataset.mode === mode;
      item.classList.toggle('active', on);
      item.setAttribute('aria-selected', String(on));
    });
  }

  function applyCopy(mode) {
    const copy = HERO_COPY[mode];
    heroBadge.textContent = copy.badge;
    heroTitle.textContent = copy.title;
    heroLede.textContent = copy.lede;
    document.querySelectorAll('#heroChecks span').forEach((item, index) => {
      const svg = item.querySelector('svg');
      item.replaceChildren(svg, document.createTextNode(' ' + copy.checks[index]));
    });
  }

  function switchTo(mode) {
    if (mode === current) return;
    clearTimeout(timer);
    heroGrid.classList.add('is-switching');
    showMode(mode);
    timer = setTimeout(() => {
      current = mode;
      showMode(mode);
      applyCopy(mode);
      onChange(mode);
      requestAnimationFrame(() => heroGrid.classList.remove('is-switching'));
    }, SWITCH_MS);
  }

  buttons.forEach((button) => button.addEventListener('click', () => switchTo(button.dataset.mode)));
  return { switchTo };
}
