import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationLink } from '@/components/location-link';
import { locationMapUrl } from '@/lib/location-links';

describe('location map links', () => {
  it('preserves the full venue, room and address in an encoded Maps search', () => {
    for (const location of ['BrewLab', 'Illini Union, Room 210, Urbana, IL', 'Café & Coffee #2, Champaign', '40.1106, -88.2073']) {
      const url = new URL(locationMapUrl(`  ${location}  `)!);
      expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
      expect(url.searchParams.get('api')).toBe('1');
      expect(url.searchParams.get('query')).toBe(location);
    }
  });

  it('keeps an exact Google or Apple Maps destination', () => {
    for (const url of ['https://www.google.com/maps/place/BrewLab/', 'https://maps.google.com/?q=BrewLab', 'https://maps.app.goo.gl/venue', 'https://goo.gl/maps/venue', 'https://maps.apple.com/?q=BrewLab']) {
      expect(locationMapUrl(url)).toBe(url);
    }
  });

  it('does not send online, unannounced, sample or unsafe locations to Maps', () => {
    for (const value of ['', ' ', 'Online · Google Meet', 'Virtual event', 'Zoom', 'Campus location to be announced', 'TBD', 'Sample listing. Check the official meeting calendar before attending.', 'https://meet.google.com/abc-defg-hij', 'javascript:alert(1)', 'https://maps.google.com.evil.test/maps', 'https://maps.google.com@evil.test/maps', 'https://user:pass@maps.google.com/maps', 'http://maps.google.com/maps', 'https://maps.google.com:444/maps', 'https://www.google.com/search?q=BrewLab']) {
      expect(locationMapUrl(value)).toBeUndefined();
    }
  });

  it('renders a descriptive external link only for a usable venue', () => {
    const render = (location: string) => renderToStaticMarkup(createElement(LocationLink, { location }));
    expect(render('BrewLab')).toContain('rel="noopener noreferrer"');
    expect(render('BrewLab')).toContain('opens Maps in a new tab');
    expect(render('https://maps.app.goo.gl/venue')).toContain('View location in Maps');
    expect(render('Online · Google Meet')).not.toContain('<a');
    expect(render('TBD')).not.toContain('<a');
    expect(render('')).toBe('');
  });
});
