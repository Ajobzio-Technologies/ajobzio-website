/* Everything the pages ask of a backend, behind one interface.
   'server' mode calls this app's /api routes; 'static' mode (GitHub Pages) does the same work in the browser.
   Every call resolves to the same shapes the /api routes return: { ok, ...data } or { ok: false, error }. */
import { config } from '../lib/config.js';
import * as serverBackend from './server-backend.js';
import * as staticBackend from './static-backend.js';

const backend = config.mode === 'static' ? staticBackend : serverBackend;

export default backend;
