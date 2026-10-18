import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch as doesProxyMatch } from 'next/experimental/testing/server';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hiddenDestination, hiddenFeatures, isPathHidden } from '@/hidden/features';
import { config, proxy } from '@/proxy';
import { adminConfig, adminLinks } from '@/lib/admin-config';

vi.mock('@/lib/site-content',async()=>({getSiteContent:async()=>structuredClone((await import('@/lib/site-content-schema')).siteContentDefaults)}));
vi.mock('@/lib/site-visibility',()=>({getUncachedVisibility:async()=>({learn:true,meetings:true,newsletter:true,exports:true})}));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/admin-data', () => ({ getAdminStats: async () => ({ published_count: 3, submission_count: 4, median_publish_hours: 24, active_writer_count: 2, subscriber_count: 9, top_posts: [] }) }));
vi.mock('@/lib/data', () => ({ getStories: async () => [], getTopics: async () => [], getNextEvent: async () => null }));
import { Header } from '@/components/header';
import AdminPage from '@/app/admin/page';
import Home from '@/app/page';

const origin = 'https://example.test';
const hiddenPages = ['/learn', '/learn/housing', '/show-up', '/subscribe', '/subscribe/confirm', '/admin/learn', '/admin/meetings', '/admin/subscribers', '/admin/digest', '/admin/export'];
const hiddenApis = ['/api/admin/learn', '/api/admin/meetings', '/api/admin/subscribers', '/api/admin/digest', '/api/admin/export', '/api/subscribe'];

describe('stories and campus events scope', () => {
  it('redirects hidden pages without carrying private query strings to the destination', async () => {
    for (const path of hiddenPages) {
      expect(doesProxyMatch({ config, nextConfig: {}, url: path })).toBe(true);
      const response = await proxy(new NextRequest(`${origin}${path}?token=private-token`));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(`${origin}${hiddenDestination(path)}`);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it('stops hidden APIs before writes, email, or downloads can run', async () => {
    for (const path of hiddenApis) {
      expect(doesProxyMatch({ config, nextConfig: {}, url: path })).toBe(true);
      const response = await proxy(new NextRequest(`${origin}${path}`, { method: path.endsWith('/export') ? 'GET' : 'POST' }));
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({ error: 'Not found.' });
    }
  });

  it('keeps publishing, reading, events, accounts, and existing unsubscribe links available', async () => {
    for (const path of ['/', '/latest', '/post/a-story', '/topic/housing', '/writer/a-writer', '/search', '/events', '/events/id/calendar.ics', '/write', '/review', '/account', '/admin/reviewers', '/admin/topics', '/admin/writers', '/admin/events', '/api/admin/events', '/api/review/id', '/unsubscribe', '/api/unsubscribe']) {
      expect(isPathHidden(path), path).toBe(false);
    }
    const unsubscribe = await proxy(new NextRequest(`${origin}/unsubscribe?token=existing`, { method: 'POST' }));
    expect(unsubscribe.headers.get('x-middleware-rewrite')).toBe(`${origin}/api/unsubscribe?token=existing`);
  });

  it('can restore every preserved feature through the same switches', () => {
    const restored = { learn: false, meetings: false, newsletter: false, exports: false };
    for (const path of [...hiddenPages, ...hiddenApis]) expect(hiddenDestination(path, restored)).toBeNull();
    expect(hiddenDestination('/learn/guide', { ...hiddenFeatures, learn: false })).toBeNull();
    expect(hiddenDestination('/show-up', { ...hiddenFeatures, learn: false })).toBe('/events');
    expect(adminConfig.learn.table).toBe('learn_pages');
    expect(adminConfig.meetings.table).toBe('meetings');
  });

  it('matches route boundaries, trailing slashes, and encoded segments', () => {
    expect(isPathHidden('/admin/learn/')).toBe(true);
    expect(isPathHidden('/admin/%6Cearn')).toBe(true);
    expect(isPathHidden('/learned')).toBe(false);
    expect(isPathHidden('/api/admin/events')).toBe(false);
  });

  it('hides entry points on both sides while retaining stories and campus events', async () => {
    const header = renderToStaticMarkup(createElement(Header));
    expect(header).toContain('href="/latest"');
    expect(header).toContain('href="/events"');
    expect(header).not.toContain('href="/learn"');
    expect(header).not.toContain('href="/show-up"');
    expect(adminLinks.map(([href]) => href)).toEqual(['/admin', '/admin/site-content', '/admin/reviewers', '/admin/topics', '/admin/events', '/admin/writers']);
    const admin = renderToStaticMarkup(await AdminPage());
    expect(admin).toContain('Manage events');
    expect(admin).not.toMatch(/Confirmed subscribers|Manage explainers|Export content/);
    const home = renderToStaticMarkup(await Home());
    expect(home).toContain('Write the stories');
    expect(home).toContain('Our next event');
    expect(home).not.toContain('id="subscribe"');
    expect(home).not.toContain('In your inbox');
  });
});
