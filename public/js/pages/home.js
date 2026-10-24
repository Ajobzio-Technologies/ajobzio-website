/* Home page: wires the hero, quote form, place search, map picker and contact dialog together. */
import { initHeroMode } from '../home/hero-mode.js';
import { initHeroBanners } from '../home/hero-banners.js';
import { createQuoteForm } from '../home/quote-form.js';
import { createMapPicker } from '../home/map-picker.js';
import { attachPlaces } from '../home/places-autocomplete.js';
import { initCtaSearch } from '../home/cta-search.js';
import { initServiceLinks } from '../home/service-links.js';
import { initQuoteFloat } from '../home/quote-float.js';
import { saveQuote } from '../lib/quote-store.js';

/* A finished quote opens the confirmation page, which shows the route and estimate and takes contact details. */
const quoteForm = createQuoteForm({
  onSubmit() {
    if (saveQuote(quoteForm.quoteData())) window.location.href = '/quote';
    else quoteForm.showPlaceError('Your browser blocked saving this quote. Please allow site storage, or message us on WhatsApp.');
  }
});
// Before the hero switch, so its tab clicks move the form into view first.
initQuoteFloat();
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
