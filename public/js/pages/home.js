/* Home page: wires the hero, quote form, place search, map picker and contact dialog together. */
import { initHeroMode } from '../home/hero-mode.js';
import { initHeroBanners } from '../home/hero-banners.js';
import { createQuoteForm } from '../home/quote-form.js';
import { createContactDialog } from '../home/contact-dialog.js';
import { createMapPicker } from '../home/map-picker.js';
import { attachPlaces } from '../home/places-autocomplete.js';
import { initCtaSearch } from '../home/cta-search.js';
import { initServiceLinks } from '../home/service-links.js';

const quoteForm = createQuoteForm({ onSubmit: () => contactDialog.open() });
const contactDialog = createContactDialog({
  getRows: quoteForm.summaryRows,
  getPlaces: quoteForm.pickedPlaces
});
const heroMode = initHeroMode({ onChange: quoteForm.setMode });
const mapPicker = createMapPicker();

const { fromInput, toInput, serviceArea } = quoteForm.fields;
[fromInput, toInput, serviceArea].forEach((input) => attachPlaces(input, {
  showError: quoteForm.showPlaceError,
  onChange: quoteForm.syncLocationReady,
  pickOnMap: mapPicker.open
}));
attachPlaces(mapPicker.searchInput, {
  showError: mapPicker.showError,
  onPick: mapPicker.centerOn
});

initCtaSearch({ switchMode: heroMode.switchTo, fields: quoteForm.fields });
initServiceLinks({ switchMode: heroMode.switchTo, fields: quoteForm.fields });
initHeroBanners();
