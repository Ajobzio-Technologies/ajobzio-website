/* Legal pages: highlights the contents link for the section being read. */
const links = [...document.querySelectorAll('.legal-toc a')];
const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);

function setActive(id) {
  links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === '#' + id));
}

/* The current section is the last one whose top has passed just below the sticky header. */
function update() {
  const line = 140;
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= line) current = section;
  }
  /* At the very bottom, the last sections may never reach the line. */
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
  if (current) setActive(current.id);
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    update();
  });
}, { passive: true });
links.forEach((link) => link.addEventListener('click', () => setActive(link.getAttribute('href').slice(1))));
update();
