/* Header pill: cycles the served district names and highlights the same one in its list.
   The list closes on an outside click or Escape. */
const CYCLE_MS = 2400;
const SLIDE_MS = 500;

export function initAreasPill() {
  const areas = document.querySelector('.areas');
  if (!areas) return;
  const names = [...areas.querySelectorAll('.areas-rotor b')];
  const rows = [...areas.querySelectorAll('.areas-list li')];
  let current = 0;

  setInterval(() => {
    if (areas.open || document.hidden) return;
    const prev = names[current];
    current = (current + 1) % names.length;
    prev.classList.replace('is-on', 'is-off');
    names[current].classList.remove('is-off');
    names[current].classList.add('is-on');
    setTimeout(() => prev.classList.remove('is-off'), SLIDE_MS);
    rows.forEach((row, i) => row.classList.toggle('is-current', i === current));
  }, CYCLE_MS);

  document.addEventListener('click', (event) => {
    if (areas.open && !areas.contains(event.target)) areas.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && areas.open) {
      areas.open = false;
      areas.querySelector('summary').focus();
    }
  });
}
