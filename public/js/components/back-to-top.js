/* Up-arrow button in the bottom-right corner: appears once the page is scrolled down, returns to the top.
   On phones it only shows while scrolling back up, so it doesn't cover what you're reading (or the footer). */
const SHOW_AFTER_PX = 400;
/* Ignore tiny scroll jitters when working out the direction. */
const DIRECTION_THRESHOLD_PX = 6;

export function initBackToTop() {
  const button = document.querySelector('.back-to-top');
  if (!button) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(max-width: 760px)');
  let lastY = window.scrollY;
  let scrollingUp = false;

  function update() {
    const y = window.scrollY;
    if (Math.abs(y - lastY) > DIRECTION_THRESHOLD_PX) {
      scrollingUp = y < lastY;
      lastY = y;
    }
    const show = y > SHOW_AFTER_PX && (!phone.matches || scrollingUp);
    button.classList.toggle('is-visible', show);
  }

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
  window.addEventListener('scroll', update, { passive: true });
  update();
}
