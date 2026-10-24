/* When the hero is scrolled away, picking Parcel delivery or Local service in the stuck switch
   brings the quote box to the reader instead of sending them back up. The same form is moved
   into a floating panel (so its state and listeners stay), and it fades back home once the
   page is scrolled again. */
const FADE_MS = 250;
const SCROLL_TO_CLOSE = 40;
/* Switching modes rewrites the hero copy; on phones that changes its height and the browser
   shifts the page to compensate. Page movement this soon after a tab click is that, not the reader. */
const SETTLE_MS = 500;

export function initQuoteFloat() {
  const quote = document.getElementById('quote');
  const modes = document.getElementById('heroModes');
  const buttons = modes.querySelectorAll('.modes button');
  const placeholder = document.createElement('div');
  const panel = document.createElement('div');
  panel.className = 'quote-float';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Get a quote');
  panel.hidden = true;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'quote-float-close';
  close.setAttribute('aria-label', 'Close quote');
  close.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  // The scroller casts the card's shadow itself, so scrolling inside it on phones never clips it.
  const scroller = document.createElement('div');
  scroller.className = 'quote-float-scroll';
  panel.append(close, scroller);
  document.body.append(panel);

  let openedAt = 0;
  let settleUntil = 0;
  let timer = null;

  // The hero's quote box counts as on screen while a good part of it shows below the switch.
  function heroQuoteVisible() {
    const rect = (panel.hidden ? quote : placeholder).getBoundingClientRect();
    const top = modes.getBoundingClientRect().bottom;
    return rect.bottom > top + 120 && rect.top < window.innerHeight - 120;
  }

  function open() {
    clearTimeout(timer);
    if (panel.hidden) {
      placeholder.style.height = quote.offsetHeight + 'px';
      quote.replaceWith(placeholder);
      scroller.append(quote);
      scroller.scrollTop = 0;
      panel.style.top = modes.getBoundingClientRect().bottom + 8 + 'px';
      panel.hidden = false;
    }
    openedAt = window.scrollY;
    requestAnimationFrame(() => panel.classList.add('is-open'));
  }

  function dismiss() {
    if (panel.hidden || !panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    timer = setTimeout(() => {
      placeholder.replaceWith(quote);
      panel.hidden = true;
    }, FADE_MS);
  }

  buttons.forEach((button) => button.addEventListener('click', () => {
    settleUntil = performance.now() + SETTLE_MS;
    if (!heroQuoteVisible()) open();
  }));
  close.addEventListener('click', dismiss);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismiss();
  });
  window.addEventListener('scroll', () => {
    if (performance.now() < settleUntil) {
      openedAt = window.scrollY;
      return;
    }
    // Typing on a phone can nudge the page as the keyboard opens; don't close mid-entry.
    if (panel.contains(document.activeElement) && document.activeElement.matches('input, textarea')) return;
    if (Math.abs(window.scrollY - openedAt) > SCROLL_TO_CLOSE) dismiss();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (!panel.hidden) panel.style.top = modes.getBoundingClientRect().bottom + 8 + 'px';
  });

  return { open, dismiss };
}
