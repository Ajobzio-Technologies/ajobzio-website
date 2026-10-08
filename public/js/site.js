/* Runs on every page: the header's mobile menu and served-areas pill, and the back-to-top button. */
import { initNavMenu } from './components/nav-menu.js';
import { initAreasPill } from './components/areas-pill.js';
import { initBackToTop } from './components/back-to-top.js';

initNavMenu();
initAreasPill();
initBackToTop();
