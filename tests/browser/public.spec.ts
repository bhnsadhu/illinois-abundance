import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import type axe from 'axe-core';

const require = createRequire(import.meta.url);
const pages = ['/', '/latest', '/events', '/about', '/write', '/write/verify', '/search', '/search?q=homes', '/search?q=zzzzzzzzzz', '/login', '/login/admin', '/post/room-for-more-neighbors', '/topic/housing', '/writer/maya-patel'];

for (const path of pages) {
  test(`${path} renders accessibly without broken content`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => {
      const result = await (window as typeof window & { axe: typeof axe }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } });
      return result.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }));
    });
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await page.evaluate(() => [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.src))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('mobile navigation opens, follows links, and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Events' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Events' }).click();
  await expect(page).toHaveURL('/events');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('keyboard skip link bypasses navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
});

test('search, story, writer, and share links work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/search');
  await page.getByRole('searchbox').fill('homes');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=homes/);
  const story = page.locator('.story-card-link').first();
  await expect(story).toBeVisible();
  await story.click();
  await expect(page.locator('.article-heading h1')).toBeVisible();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status')).toContainText('Ready to share.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.locator('.writer-box h2 a').click();
  await expect(page).toHaveURL(/\/writer\//);
});

test('reduced motion and small screens preserve usable content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  expect(await page.locator('h1 svg').evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.locator('main').getByRole('link', { name: 'Publish with us', exact: false }).first()).toBeVisible();
});

test('protected pages redirect and unknown content returns 404', async ({ request }) => {
  for (const [path, target] of [['/admin', '/login/admin'], ['/review', '/login'], ['/account', '/login']]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(target);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
  for (const path of ['/missing-page', '/post/missing-story', '/covers/invalid', '/media/invalid']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test('security policy permits selected-image previews', async ({ page }) => {
  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image.naturalWidth;
    } finally { URL.revokeObjectURL(url); }
  });
  expect(loaded).toBe(2);
});

test('public pages do not attempt dynamic code evaluation', async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  const violations: string[] = [];
  await client.send('Audits.enable');
  client.on('Audits.issueAdded', ({ issue }) => {
    if (issue.code === 'ContentSecurityPolicyIssue') violations.push(issue.details.contentSecurityPolicyIssueDetails?.violatedDirective || issue.code);
  });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(violations).toEqual([]);
});

test('article view counting finishes without holding a background connection open', async ({ page }) => {
  const finished = page.waitForEvent('requestfinished', {
    predicate: request => new URL(request.url()).pathname === '/api/views',
    timeout: 5000,
  });
  // The isolated server returns a real service-unavailable response; no live data is written.
  await Promise.all([finished, page.goto('/post/room-for-more-neighbors')]);
  await expect(page.locator('.article-heading h1')).toBeVisible();
});
