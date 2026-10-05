import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function captureState(page: Page, state: string, isMobile: boolean) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await mkdir('.artifacts/request-states', { recursive: true });
  await page.getByRole('main').screenshot({
    path: `.artifacts/request-states/${state}-${isMobile ? 'mobile' : 'desktop'}.png`,
    animations: 'disabled',
  });
}

test('shows a skeleton until the API response arrives', async ({ page, isMobile }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/clients', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/');
  try {
    await expect(page.getByRole('status', { name: 'Loading client data' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await captureState(page, 'loading', isMobile);
  } finally {
    release();
  }
  await expect(page.getByRole('button', { name: 'Expand Branch 1', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading client data' })).toHaveCount(0);
});

test('recovers from a server error through a pending keyboard retry', async ({ page, isMobile }) => {
  let fail = true;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/clients', async (route) => {
    if (fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Unavailable"}',
      });
    } else {
      await pending;
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The server couldn’t return your client data.');
  await expect(page.getByRole('alert')).not.toContainText('Check your connection');
  await expect(page.getByRole('table')).toHaveCount(0);
  await captureState(page, 'server-error', isMobile);
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).focus();
  await page.keyboard.press('Enter');
  try {
    await expect(page.getByRole('status', { name: 'Loading client data' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
    await captureState(page, 'retry-loading', isMobile);
  } finally {
    release();
  }
  await expect(page.getByRole('button', { name: 'Expand Branch 1', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading client data' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await captureState(page, 'recovered', isMobile);
});

const failures = [
  {
    name: 'connection-error',
    message: 'We couldn’t reach the server. Check your connection and try again.',
    respond: (route: Route) => route.abort('failed'),
  },
  {
    name: 'invalid-json',
    message: 'The client data is incomplete or has an unexpected format. Please try again.',
    respond: (route: Route) => route.fulfill({
      status: 200, contentType: 'application/json', body: 'invalid json',
    }),
  },
  {
    name: 'invalid-data',
    message: 'The client data is incomplete or has an unexpected format. Please try again.',
    respond: (route: Route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'company', name: 'Company', values: [10] }),
    }),
  },
];

for (const failure of failures) {
  test(`explains ${failure.name} and recovers on retry`, async ({ page, isMobile }) => {
    let fail = true;
    await page.route('**/api/clients', (route) => fail ? failure.respond(route) : route.continue());
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText(failure.message);
    await expect(page.getByRole('table')).toHaveCount(0);
    await captureState(page, failure.name, isMobile);
    fail = false;
    const retry = page.getByRole('button', { name: 'Try again', exact: true });
    if (isMobile) await retry.tap();
    else await retry.click();
    await expect(page.getByRole('button', { name: 'Expand Branch 1', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
