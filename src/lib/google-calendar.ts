import 'server-only';
import { createHash } from 'node:crypto';
import { Temporal } from 'temporal-polyfill';
import ical, { type ParameterValue } from 'node-ical';
import type { Event } from './types';

// This calendar is public. Only the public feed is read; no account access is needed.
export const googleCalendarId = 'cb293f04059f359271b6fbdc1b622f7f1e8bff9499b6f24e0435a6051b350e32@group.calendar.google.com';
export const googleCalendarHref = `https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(googleCalendarId)}`;
const feedHref = `https://calendar.google.com/calendar/ical/${encodeURIComponent(googleCalendarId)}/public/basic.ics`;
const day = 86_400_000;
// iCalendar DATE values use host-local components. Interpret those dates in
// Champaign Urbana so all-day events end at local midnight on every server.
const localDay = (date: Date) => new Date(Temporal.PlainDate.from({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }).toZonedDateTime('America/Chicago').epochMilliseconds).toISOString();
const plainText = (value?: ParameterValue) => typeof value === 'string' ? value : value?.val || '';

export async function parseCalendarEvents(source: string, now = new Date()): Promise<Event[]> {
  if (!source.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Invalid public calendar.');
  const calendar = await ical.async.parseICS(source);
  const events: Event[] = [];
  for (const item of Object.values(calendar)) {
    if (item?.type !== 'VEVENT' || item.status === 'CANCELLED' || item.class === 'PRIVATE' || item.class === 'CONFIDENTIAL' || !item.start) continue;
    const instances = ical.expandRecurringEvent(item, {
      from: new Date(now.getTime() - 90 * day),
      to: new Date(now.getTime() + 366 * day),
      expandOngoing: true,
    });
    for (const instance of instances) {
      const event = instance.event;
      if (event.status === 'CANCELLED' || event.class === 'PRIVATE' || event.class === 'CONFIDENTIAL') continue;
      const title = plainText(instance.summary).trim();
      if (!title || !Number.isFinite(instance.start.getTime()) || !Number.isFinite(instance.end.getTime())) continue;
      const starts_at = instance.isFullDay ? localDay(instance.start) : instance.start.toISOString();
      const id = `gcal-${createHash('sha256').update(`${item.uid}:${starts_at}`).digest('hex').slice(0, 24)}`;
      events.push({
        id, slug: id, title,
        description: plainText(event.description),
        starts_at, ends_at: instance.isFullDay ? localDay(instance.end) : instance.end.toISOString(),
        location: plainText(event.location),
        rsvp_url: null, recap_post_id: null, is_published: true, is_sample: false,
        all_day: instance.isFullDay, calendar_url: googleCalendarHref,
      });
    }
  }
  return events.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export async function getGoogleCalendarEvents(): Promise<Event[]> {
  try {
    const response = await fetch(feedHref, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const source = await response.text();
    if (source.length > 2_000_000) return [];
    return await parseCalendarEvents(source);
  } catch {
    // Local listings and the direct calendar link remain usable during an outage.
    return [];
  }
}

export function mergeCalendarEvents(local: Event[], calendar: Event[]): Event[] {
  const key = (event: Event) => `${Date.parse(event.starts_at)}:${event.title.trim().toLowerCase()}`;
  const localKeys = new Set(local.filter(event => !event.is_sample).map(key));
  return [...local.filter(event => !calendar.length || !event.is_sample), ...calendar.filter(event => !localKeys.has(key(event)))]
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
