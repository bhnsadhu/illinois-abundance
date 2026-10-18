import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleCalendarEvents, mergeCalendarEvents, parseCalendarEvents } from '@/lib/google-calendar';
import { eventDate, eventEnd } from '@/lib/syndication';

const now = new Date('2026-10-18T12:00:00Z');
const feed = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.map(event => `BEGIN:VEVENT\r\n${event}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR`;
const event = (extra = '') => `UID:one@google.com\r\nDTSTART:20261018T230000Z\r\nDTEND:20261019T000000Z\r\nSUMMARY:Community gathering\r\n${extra}`;
afterEach(() => vi.unstubAllGlobals());

describe('public Google Calendar', () => {
  it('reads folded and escaped text and keeps stable occurrence IDs', async () => {
    const source = feed(event('LOCATION:Cloud Mountain\\, Urbana\r\nDESCRIPTION:First line\\nSecond\r\n  line'));
    const events = await parseCalendarEvents(source, now);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({title:'Community gathering', location:'Cloud Mountain, Urbana', description:'First line\nSecond line', starts_at:'2026-10-18T23:00:00.000Z', ends_at:'2026-10-19T00:00:00.000Z', is_sample:false, all_day:false});
    expect((await parseCalendarEvents(source, now))[0].id).toBe(events[0].id);
  });

  it('extracts join links from conference metadata, locations and descriptions', async () => {
    const room='https://meet.google.com/abc-defg-hij';
    for (const field of ['X-GOOGLE-CONFERENCE','URL','LOCATION','DESCRIPTION']) {
      const [parsed]=await parseCalendarEvents(feed(event(`${field}:${room}`)),now);
      expect(parsed.join_url).toBe(room);
    }
    const [parsed]=await parseCalendarEvents(feed(event('X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij\r\nDESCRIPTION:Join https://meet.google.com/xyz-abcd-efg')),now);
    expect(parsed.join_url).toBe(room);
    const local={...parsed,id:'local',location:'Campus library',join_url:undefined};
    expect(mergeCalendarEvents([local],[parsed])).toEqual([{...local,join_url:room}]);
  });

  it('expands weekly meetings across daylight saving and honors exclusions, moved and cancelled occurrences', async () => {
    const source = feed(
      'UID:weekly\r\nDTSTART;TZID=America/Chicago:20261022T163000\r\nDTEND;TZID=America/Chicago:20261022T173000\r\nRRULE:FREQ=WEEKLY;COUNT=5\r\nEXDATE;TZID=America/Chicago:20261029T163000\r\nSUMMARY:Weekly meeting',
      'UID:weekly\r\nRECURRENCE-ID;TZID=America/Chicago:20261112T163000\r\nDTSTART;TZID=America/Chicago:20261112T180000\r\nDTEND;TZID=America/Chicago:20261112T190000\r\nSUMMARY:Moved meeting',
      'UID:weekly\r\nRECURRENCE-ID;TZID=America/Chicago:20261119T163000\r\nDTSTART;TZID=America/Chicago:20261119T163000\r\nSTATUS:CANCELLED\r\nSUMMARY:Cancelled meeting',
    );
    const events = await parseCalendarEvents(source, now);
    expect(events.map(event => event.starts_at)).toEqual(['2026-10-22T21:30:00.000Z','2026-11-05T22:30:00.000Z','2026-11-13T00:00:00.000Z']);
    expect(events[2].title).toBe('Moved meeting');
    expect(new Set(events.map(event => event.id)).size).toBe(3);
  });

  it('keeps all-day events on their Chicago date and ends them at local midnight across DST', async () => {
    const events = await parseCalendarEvents(feed('UID:all-day\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102\r\nSUMMARY:Community day'), now);
    expect(events[0]).toMatchObject({all_day:true,starts_at:'2026-11-01T05:00:00.000Z',ends_at:'2026-11-02T06:00:00.000Z'});
    expect(eventDate(events[0].starts_at, true)).toBe('Sun, November 1, 2026 · All day');
    expect(eventEnd(events[0])).toBe(Date.parse('2026-11-02T06:00:00Z'));
  });

  it('omits cancelled, private, confidential and out-of-range events', async () => {
    for (const extra of ['STATUS:CANCELLED','CLASS:PRIVATE','CLASS:CONFIDENTIAL']) expect(await parseCalendarEvents(feed(event(extra)), now)).toEqual([]);
    expect(await parseCalendarEvents(feed('UID:old\r\nDTSTART:20200101T120000Z\r\nSUMMARY:Old meeting'), now)).toEqual([]);
    await expect(parseCalendarEvents('<html>Sign in</html>', now)).rejects.toThrow('Invalid public calendar');
  });

  it('falls back safely for failed requests, invalid feeds and timeouts', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('Unavailable', {status:503}));
    expect(await getGoogleCalendarEvents()).toEqual([]);
    fetchMock.mockResolvedValue(new Response('<html>Sign in</html>'));
    expect(await getGoogleCalendarEvents()).toEqual([]);
    fetchMock.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    expect(await getGoogleCalendarEvents()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/public/basic.ics'), expect.objectContaining({next:{revalidate:300},signal:expect.any(AbortSignal)}));
  });

  it('retains local details for duplicates and does not mix sample events into a live calendar', async () => {
    const [remote] = await parseCalendarEvents(feed(event()), now);
    const local = {...remote,id:'local',location:'Local details',calendar_url:undefined};
    const sample = {...remote,id:'sample',title:'Sample gathering',is_sample:true};
    expect(mergeCalendarEvents([local,sample],[remote])).toEqual([local]);
    expect(mergeCalendarEvents([sample],[])).toEqual([sample]);
  });
});
