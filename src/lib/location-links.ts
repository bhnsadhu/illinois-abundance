/** Maps URLs open the provider's app when available, with a browser fallback. */
export function locationMapUrl(value: string): string | undefined {
  const location = value.trim();
  if (!location) return;

  if (/^https?:\/\//i.test(location)) {
    try {
      const url = new URL(location);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
      const googleMaps = ['google.com', 'www.google.com'].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname);
      const shortMaps = url.hostname === 'goo.gl' && /^\/maps\//.test(url.pathname);
      if (googleMaps || shortMaps || ['maps.google.com', 'maps.app.goo.gl', 'maps.apple.com'].includes(url.hostname)) return url.href;
    } catch { /* Keep malformed links as plain location text. */ }
    return;
  }

  // An online room or an unannounced venue is not a physical destination.
  if (/https?:\/\/|\b(?:online|virtual|remote|zoom|google meet|microsoft teams|tba|tbd|to be (?:announced|confirmed|determined)|location pending|sample listing)\b/i.test(location)) return;
  if (/^[a-z][a-z\d+.-]*:|^www\./i.test(location)) return;

  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: location })}`;
}
