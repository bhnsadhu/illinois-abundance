/** Find a standard Google Meet room without accepting lookalike hosts or redirects. */
export function googleMeetUrl(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = typeof value === 'string' ? value : value && typeof value === 'object' && 'val' in value && typeof value.val === 'string' ? value.val : '';
    for (const match of text.matchAll(/https:\/\/[^\s<>"']+/gi)) {
      try {
        const url = new URL(match[0].replace(/[).,;!?]+$/, ''));
        if (url.hostname === 'meet.google.com' && !url.username && !url.password && !url.port && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)) {
          return `https://meet.google.com${url.pathname.replace(/\/$/, '')}`;
        }
      } catch { /* A malformed link should not hide the rest of the event. */ }
    }
  }
}

export function eventLocation(event: {location: string; join_url?: string}): string {
  const location = event.location.trim();
  const meet = googleMeetUrl(event.join_url);
  if (meet && (!location || /^https:\/\/\S+$/.test(location) && googleMeetUrl(location))) return 'Online · Google Meet';
  return location;
}
