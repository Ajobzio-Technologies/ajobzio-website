/* Settings the page was built with (see the AJOBZIO_CONFIG script in the head).
   mode: 'server' when served by the Express app, 'static' on GitHub Pages. */
export const config = Object.freeze({ mode: 'server', ...(window.AJOBZIO_CONFIG || {}) });
