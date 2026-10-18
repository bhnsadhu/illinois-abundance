import { expect, test } from '@playwright/test';

test('a writer can recover from a failed request, verify, and reach confirmation', async ({ page }) => {
  await page.goto('/write');
  const body = 'More homes near campus would give students more choices and keep our community welcoming.';
  await page.locator('[name=name]').fill('Test Writer');
  await page.locator('[name=email]').fill('student@ILLINOIS.EDU');
  await page.locator('[name=body]').fill(body);
  await page.route('**/api/submissions', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' }));
  await page.locator('.submission-form button[type=submit], .submission-form button:not([type])').click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Please try again in a moment.');
  await expect(page.locator('[name=body]')).toHaveValue(body);
  await page.unroute('**/api/submissions');
  await page.route('**/api/submissions', route => route.fulfill({ json: { ok: true } }));
  await page.locator('.submission-form button:not([type])').click();
  await expect(page).toHaveURL('/write/verify');
  await page.route('**/api/submissions/verify', route => route.fulfill({ status: 400, json: { error: 'That code has expired. Send a new code and try again.' } }));
  await page.getByLabel('Your six digit code').fill('123456');
  await page.locator('.verify-card > button').click();
  await expect(page.locator('main').getByRole('alert')).toContainText('expired');
  await page.route('**/api/submissions/resend', route => route.fulfill({ json: { ok: true } }));
  await page.getByRole('button', { name: /Send a new code/ }).click();
  await expect(page.getByRole('status')).toContainText('A new code is on its way');
  await page.unroute('**/api/submissions/verify');
  await page.route('**/api/submissions/verify', route => route.fulfill({ json: { ok: true } }));
  await page.getByLabel('Your six digit code').fill('654321');
  await page.locator('.verify-card > button').click();
  await expect(page.locator('.success-state h1')).toBeFocused();
  await expect(page.locator('.success-state a')).toHaveAttribute('href', '/latest');
});

test('login errors remain actionable and retryable', async ({ page }) => {
  await page.goto('/login/admin');
  await page.getByLabel('Email').fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Not a real password');
  await page.route('**/api/login', route => route.fulfill({ status: 401, json: { error: 'Email or password is incorrect for this sign in.' } }));
  await page.locator('.login-form button').click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Email or password is incorrect');
  await expect(page.locator('.login-form button')).toBeEnabled();
  await page.unroute('**/api/login');
  await page.route('**/api/login', route => route.fulfill({ status: 502, body: 'Bad gateway' }));
  await page.locator('.login-form button').click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Please try again in a moment.');
});
