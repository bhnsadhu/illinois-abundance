import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import type axe from 'axe-core';

const require = createRequire(import.meta.url);
const pages = ['/', '/latest', '/news', '/events', '/about', '/write', '/write/verify', '/search', '/search?q=homes', '/search?q=zzzzzzzzzz', '/login', '/login/admin', '/post/room-for-more-neighbors', '/topic/housing', '/writer/maya-patel'];

for (const path of pages) {
  test(`${path} renders accessibly without broken content`, async ({ page }) => {
    // Audit settled contrast; the motion-specific tests cover animated entry and dismissal.
    await page.emulateMedia({ reducedMotion: 'reduce' });
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

test('the compact opening pairs the introduction with an event and links to a separate news page', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const title = page.getByRole('heading', { level: 1 });
  const event = page.getByRole('region', { name: 'Our next event' });
  await expect(event).toBeInViewport();
  const titleBox = (await title.boundingBox())!;
  const eventBox = (await event.boundingBox())!;
  if (isMobile) expect(eventBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  else {
    expect(eventBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
    expect(eventBox.y + eventBox.height).toBeLessThan(700);
  }
  await expect(page.locator('.site-header .brand-people image')).toHaveAttribute('href', '/brand/logo-transparent.png');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/favicon.svg');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  const navigation = page.getByRole('navigation', { name: isMobile ? 'Mobile navigation' : 'Main navigation' });
  await navigation.getByRole('link', { name: 'News', exact: true }).click();
  await expect(page).toHaveURL('/news');
  await expect(page).toHaveTitle('News · Illinois Abundance');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(navigation.getByRole('link', { name: 'News', exact: true })).toHaveAttribute('aria-current', 'page');
  if (isMobile) await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Around Champaign Urbana');
  await expect(page.locator('main article')).toHaveCount(3);
  for (const link of await page.locator('main article h2 a').all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\//);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('keyboard focus reveals offscreen editorial content immediately', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('.reveal[data-reveal=pending]').last();
  const heading = await section.getByRole('heading').first().textContent();
  await section.getByRole('link').first().focus();
  const revealed = page.locator('.reveal').filter({ has: page.getByRole('heading', { name: heading!, exact: true }) });
  await expect(revealed).toHaveAttribute('data-reveal', 'instant');
  await expect(revealed).toHaveCSS('opacity', '1');
  await expect(revealed).toHaveCSS('transform', 'none');
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
  expect(await page.locator('main').evaluate(main => main.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.locator('main').getByRole('link', { name: 'Write the Stories', exact: false }).first()).toBeVisible();
});

test('the welcome plays once per session and exits without blocking the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-22T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'play');
  await expect(page.getByTestId('site-intro')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('site-intro')).toHaveCSS('pointer-events', 'auto');
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Champaign Urbana. Cultivating Our Garden');
  await page.clock.fastForward(3500);
  await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  await expect(page.locator('html')).not.toHaveAttribute('data-arrival');
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  await expect(page.getByTestId('site-intro')).toBeHidden();
});

test('the first tap dismisses the welcome without following a hidden link', async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-22T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
  await page.goto('/');
  const stories = page.locator('main').getByRole('link', { name: 'Read the Stories', exact: true });
  const bounds = (await stories.boundingBox())!;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.getByTestId('site-intro')).toBeHidden();
  await expect(page).toHaveURL('/');
  await stories.click();
  await expect(page).toHaveURL('/latest');
});

test('keyboard input skips the welcome and reduced motion keeps the garden still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-22T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  await expect(page.locator('html')).not.toHaveAttribute('data-arrival');
  const garden = page.getByTestId('hero-garden');
  await expect(garden).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('scroll-garden')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await garden.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('blocked session storage cannot strand the welcome', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage is disabled'); } }));
  await page.goto('/');
  await expect(page.getByTestId('site-intro')).toBeHidden({ timeout: 5000 });
  await page.locator('main').getByRole('link', { name: 'Read the Stories', exact: true }).click();
  await expect(page).toHaveURL('/latest');
});

test('deep links and JavaScript-free visits show usable content immediately', async ({ page, browser }) => {
  await page.goto('/#get-involved');
  await expect(page.getByTestId('site-intro')).toBeHidden();
  await expect(page.locator('#involvement-title')).toBeInViewport();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto('http://localhost:3100/');
  await expect(plain.getByTestId('site-intro')).toBeHidden();
  await expect(plain.getByRole('heading', { level: 1 })).toHaveAccessibleName('Champaign Urbana. Cultivating Our Garden');
  await plain.locator('main').getByRole('link', { name: 'Read the Stories', exact: true }).click();
  await expect(plain).toHaveURL('http://localhost:3100/latest');
  await context.close();
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
