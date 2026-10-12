import type { Event, Story } from './types';
import { escapeHtml } from './format';

/** XML 1.0 disallows control characters even inside escaped text. */
export function xmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));
}
export function storyFeed(stories: Story[], origin: string): string {
  const base = new URL(origin).origin;
  const items = stories.map(story => {
    const url = `${base}/post/${encodeURIComponent(story.slug)}`;
    const sample = story.is_sample ? '[Sample story] ' : '';
    // RSS readers interpret description/content as HTML after parsing XML.
    // Escape article text at both layers so submitted markup stays literal.
    const body='<p>'+escapeHtml(story.final_body).replace(/\r\n|\r|\n/g,'<br/>')+'</p>';
    return `<item><title>${xmlText(sample+story.headline)}</title><link>${xmlText(url)}</link><guid isPermaLink="true">${xmlText(url)}</guid><description>${xmlText(escapeHtml(sample+story.short_version))}</description><content:encoded>${xmlText(body)}</content:encoded><dc:creator>${xmlText(story.byline || story.author_name)}</dc:creator><category>${xmlText(story.topic.name)}</category><pubDate>${new Date(story.published_at).toUTCString()}</pubDate></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Illinois Abundance</title><link>${xmlText(base)}</link><description>Student writing on local policy in Champaign Urbana.</description><language>en-us</language><atom:link href="${xmlText(base)}/rss.xml" rel="self" type="application/rss+xml"/>${items.join('')}</channel></rss>`;
}
export function calendarText(value: string): string { return value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
/** RFC 5545: fold at 75 octets without splitting a UTF-8 character. */
export function foldCalendarLine(value: string): string {
  const encoder=new TextEncoder();
  const lines: string[]=[];
  let line='', length=0;
  for (const character of value) {
    const size=encoder.encode(character).length;
    if (length+size>75) { lines.push(line); line=' '; length=1; }
    line+=character; length+=size;
  }
  lines.push(line);
  return lines.join('\r\n');
}
export function eventEnd(event: Pick<Event,'starts_at'|'ends_at'>): number {
  const start=Date.parse(event.starts_at), end=event.ends_at ? Date.parse(event.ends_at) : NaN;
  return Number.isFinite(end) && end>start ? end : start+90*60*1000;
}
export function eventCalendar(event: Event, origin: string, generatedAt = new Date()): string {
  const utc=(date: Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const base=new URL(origin).origin;
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Illinois Abundance//Community Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${event.id}@${new URL(base).hostname}`,`DTSTAMP:${utc(generatedAt)}`,`DTSTART:${utc(new Date(event.starts_at))}`,`DTEND:${utc(new Date(eventEnd(event)))}`,
    `SUMMARY:${calendarText((event.is_sample?'Sample event: ':'')+event.title)}`,
    `DESCRIPTION:${calendarText((event.is_sample?'Sample event. This is not a confirmed gathering.\n\n':'')+event.description)}`,
    `LOCATION:${calendarText(event.location)}`,`URL:${base}/events#event-${event.id}`,'END:VEVENT','END:VCALENDAR',
  ].map(foldCalendarLine).join('\r\n')+'\r\n';
}
export function eventDate(value: string): string {
  return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'}).format(new Date(value));
}
