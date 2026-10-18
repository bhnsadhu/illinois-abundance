import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { googleMeetUrl, eventLocation } from '@/lib/event-links';
import { EventJoinLink } from '@/components/event-join-link';

const room='https://meet.google.com/abc-defg-hij';
describe('event joining',()=>{
  it('finds rooms in structured values, plain text and HTML descriptions',()=>{
    for(const value of [room, {val:room}, `Join here: (${room}).`, `<a href="${room}?authuser=1">Join</a>`]) expect(googleMeetUrl(value)).toBe(room);
    expect(googleMeetUrl('not a meeting',room)).toBe(room);
  });
  it('does not turn arbitrary or deceptive links into a join button',()=>{
    for(const value of [undefined,{},'javascript:alert(1)','http://meet.google.com/abc-defg-hij','https://meet.google.com.evil.test/abc-defg-hij','https://meet.google.com@evil.test/abc-defg-hij','https://evil.test/?next=https://meet.google.com/abc-defg-hij','https://user@meet.google.com/abc-defg-hij','https://meet.google.com:444/abc-defg-hij','https://meet.google.com/lookup/something']) expect(googleMeetUrl(value)).toBeUndefined();
    expect(renderToStaticMarkup(createElement(EventJoinLink,{href:'javascript:alert(1)',label:'Join event'}))).toBe('');
    const html=renderToStaticMarkup(createElement(EventJoinLink,{href:room,label:'Join event'}));
    expect(html).toContain(`href="${room}"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('identifies online events while keeping hybrid venues and ordinary locations',()=>{
    expect(eventLocation({location:'',join_url:room})).toBe('Online · Google Meet');
    expect(eventLocation({location:room,join_url:room})).toBe('Online · Google Meet');
    expect(eventLocation({location:'  Campus library  ',join_url:room})).toBe('Campus library');
    expect(eventLocation({location:'Campus library'})).toBe('Campus library');
    expect(eventLocation({location:''})).toBe('');
  });
});
