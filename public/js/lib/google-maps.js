/* Loads the Google Maps JavaScript API once. Later calls reuse the same promise;
   a failed load is forgotten so the next call can try again. */
let loading = null;

export function loadGoogleMaps(getKey) {
  if (!loading) {
    loading = (async () => {
      const key = await getKey();
      await new Promise((resolve, reject) => {
        window.ajobzioMapsReady = resolve;
        const script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
          '&loading=async&callback=ajobzioMapsReady&region=IN&language=en';
        script.async = true;
        script.onerror = reject;
        document.head.append(script);
      });
      return window.google.maps;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}
