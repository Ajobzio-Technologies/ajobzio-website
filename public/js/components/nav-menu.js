/* Phone-width menu: the hamburger opens the nav links, any click elsewhere closes them. */
export function initNavMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!links.classList.contains('open'));
  });
  links.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => setOpen(false));
}
