/* Hero backgrounds: every image in images/hero/<set>, crossfading every 10 seconds.
   No file names live in the code; the first image to load fades in first. */
import backend from '../backend/index.js';

const SETS = [
  { selector: '.hero-bg-parcel', imageVar: '--parcel-img', set: 'parcel-delivery' },
  { selector: '.hero-bg-service', imageVar: '--svc-img', set: 'local-services' }
];
const ROTATE_MS = 10000;
const FADE_MS = 1900;

function rotateSet({ selector, imageVar, set }) {
  const first = document.querySelector(selector);
  if (!first) return;
  const banners = [];
  let current = 0;

  backend.heroImages(set)
    .then((images) => {
      images.forEach((src) => {
        /* Only join the rotation once loaded, so a crossfade never reveals a blank banner. */
        const img = new Image();
        img.onload = () => {
          const url = 'url("' + src + '")';
          if (!banners.length) {
            first.style.setProperty(imageVar, url);
            first.classList.add('is-active');
            banners.push(first);
            return;
          }
          const banner = document.createElement('div');
          banner.className = first.className.replace(' is-active', '');
          banner.setAttribute('aria-hidden', 'true');
          banner.style.setProperty(imageVar, url);
          first.before(banner);
          banners.push(banner);
        };
        img.src = src;
      });
    })
    .catch(() => {});

  setInterval(() => {
    if (document.hidden || banners.length < 2) return;
    const prev = banners[current];
    current = (current + 1) % banners.length;
    const next = banners[current];
    prev.after(next); // paint the incoming banner above the outgoing one
    prev.classList.replace('is-active', 'is-leaving');
    next.classList.add('is-fading');
    void next.offsetWidth;
    next.classList.add('is-active');
    setTimeout(() => {
      prev.classList.remove('is-leaving');
      next.classList.remove('is-fading');
    }, FADE_MS);
  }, ROTATE_MS);
}

export function initHeroBanners() {
  SETS.forEach(rotateSet);
}
