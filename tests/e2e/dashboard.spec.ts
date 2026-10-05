import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const tableName = 'Reported clients by month, February 2024 to January 2025';

async function expectTooltipContained(page: Page, month: string) {
  const tooltip = page.getByRole('tooltip', { name: month, exact: true });
  await expect(tooltip).toBeVisible();
  const chart = page.getByRole('region', {
    name: 'Chart data', exact: true,
  });
  await expect.poll(async () => {
    const box = await tooltip.boundingBox();
    const visible = await chart.boundingBox();
    if (!box || !visible) return false;
    return box.x >= visible.x - 1 && box.y >= visible.y - 1
      && box.x + box.width <= visible.x + visible.width + 1
      && box.y + box.height <= visible.y + visible.height + 1;
  }).toBe(true);
  // Existing text-only checks missed numeric columns hidden by the scroll container.
  expect(await tooltip.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [...element.querySelectorAll('dd')].every((value) => {
      const bounds = value.getBoundingClientRect();
      return bounds.left >= box.left && bounds.right <= box.right
        && bounds.top >= box.top && bounds.bottom <= box.bottom
        && value.scrollWidth <= value.clientWidth;
    });
  })).toBe(true);
}

test('loads the real API and expands all levels from the keyboard', async ({ page, request }) => {
  const response = await request.get('/api/clients');
  expect(response.ok()).toBe(true);
  expect((await response.json()).values).toEqual([
    250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350,
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const table = page.getByRole('table', { name: tableName });
  await expect(table.getByRole('row')).toHaveCount(5);
  const branch = page.getByRole('button', { name: 'Expand Branch 1', exact: true });
  await branch.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Collapse Branch 1', exact: true })).toBeFocused();
  const anna = page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true });
  await anna.focus();
  await page.keyboard.press('Space');
  await expect(table.getByRole('row')).toHaveCount(13);
  await expect(
    table.getByRole('rowheader').filter({ hasText: 'New paid' }),
  ).toHaveAccessibleDescription(/Level 4.*Company, Branch 1, Anna Blackwood/);
  await page.getByRole('button', { name: 'Collapse Company', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.keyboard.press('Space');
  await expect(table.getByRole('row')).toHaveCount(13);
  expect(errors).toEqual([]);
});

test('disclosure stays independent of chart scope', async ({ page }) => {
  await page.goto('/');
  const caption = page.getByRole('heading', { name: 'Company clients by branch', exact: true });
  await expect(caption).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Data differences' })).toHaveCount(0);
  const chart = page.getByRole('application', { name: 'Monthly clients for Company', exact: true });
  const paths = chart.locator('.recharts-bar-rectangle path');
  await expect(paths).toHaveCount(36);
  const before = await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  await page.getByText('Branch 1', { exact: true }).filter({ visible: true }).last().click();
  await page.getByText('Anna Blackwood', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: tableName }).getByText('Existing clients', { exact: true }),
  ).toBeVisible();
  expect(await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')))).toEqual(
    before,
  );
  await expect(page.getByRole('button', { name: 'Expand Branch 2', exact: true })).toBeVisible();
  await expect(caption).toBeVisible();
});

test('explains all conflicting totals with panels contained on desktop and touch screens', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true }).click();
  const table = page.getByRole('table', { name: tableName });
  const cases = [
    ['Company', 'May 2024', '301', '279'],
    ['Branch 1', 'August 2024', '214', '216'],
    ['Anna Blackwood', 'May 2024', '31', '30'],
    ['Anna Blackwood', 'June 2024', '32', '33'],
    ['Anna Blackwood', 'July 2024', '34', '35'],
    ['Anna Blackwood', 'August 2024', '38', '36'],
    ['Anna Blackwood', 'September 2024', '27', '28'],
  ];
  await expect(table.getByRole('button', { name: /^Explain/ })).toHaveCount(7);
  for (const [name, month, reported, breakdown] of cases) {
    if (isMobile) await page.touchscreen.tap(4, 4);
    else await page.mouse.click(4, 4);
    await expect(page.getByRole('tooltip', { name: /^Explain/ })).toHaveCount(0);
    const label = `Explain ${name} total for ${month}: ${reported}`;
    const button = table.getByRole('button', { name: label, exact: true });
    await button.scrollIntoViewIfNeeded();
    // Place the value in the part of the scroller not covered by the sticky name column.
    await button.evaluate((element) => {
      const scroller = element.closest('[role="region"]')!;
      const nameColumn = scroller.querySelector('th')!;
      scroller.scrollLeft += element.getBoundingClientRect().left
        - scroller.getBoundingClientRect().left - nameColumn.getBoundingClientRect().width - 24;
    });
    if (isMobile) await button.tap();
    else await button.click();
    const panel = page.getByRole('tooltip', { name: label, exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.locator('dd')).toHaveText([reported!, breakdown!]);
    await expect(table.getByRole('row')).toHaveCount(13);
    const box = await panel.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(12);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(box!.y).toBeGreaterThanOrEqual(12);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('dd')].every((value) => {
        const cell = value.getBoundingClientRect();
        return cell.left >= bounds.left && cell.right <= bounds.right
          && value.scrollWidth <= value.clientWidth;
      });
    })).toBe(true);
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: `.artifacts/totals-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
  await page.getByRole('heading', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('tooltip', { name: /^Explain/ })).toHaveCount(0);
});

test('reaches the totals explanation by Tab and dismisses it without changing row expansion', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Collapse Company', exact: true })).toBeVisible();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  const label = 'Explain Company total for May 2024: 301';
  const button = page.getByRole('button', { name: label, exact: true });
  const panel = page.getByRole('tooltip', { name: label, exact: true });
  await expect(button).toBeFocused();
  await expect(panel).toBeVisible();
  expect(await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Company', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(panel).toHaveCount(0);
});

test('actionable rows have pointer and hover feedback, including empty breakdowns', async ({ page, isMobile }) => {
  await page.goto('/');
  const action = page.getByRole('button', { name: 'Show Company in chart', exact: true });
  await expect(action).toHaveCSS('opacity', isMobile ? '1' : '0');
  await action.focus();
  await expect(action).toHaveCSS('opacity', '1');
  await page.getByRole('heading', { name: 'Clients', exact: true }).click();
  await page.mouse.move(0, 0);
  const branch = page.getByRole('button', { name: 'Expand Branch 2', exact: true });
  const row = page.getByRole('row').filter({ has: branch });
  const numericCell = row.getByRole('cell').first();
  await expect(row).toHaveCSS('cursor', 'pointer');
  await expect(numericCell).toHaveCSS('cursor', 'pointer');
  const background = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  await numericCell.hover();
  await expect(row).not.toHaveCSS('background-color', background);
  await numericCell.click();
  const empty = page.getByRole('status', { name: 'Branch 2 breakdown', exact: true });
  await expect(empty).toHaveText('No advisor data available.');
  await expect(empty).toHaveCSS('cursor', 'default');
  await page.getByRole('button', { name: 'Collapse Branch 2', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(empty).toHaveCount(0);

  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true }).click();
  const channel = page.getByRole('row').filter({
    has: page.getByRole('rowheader').filter({ hasText: 'New paid' }),
  });
  await expect(channel).toHaveCSS('cursor', 'default');
  const channelBackground = await channel.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await channel.hover();
  await expect(channel).toHaveCSS('background-color', channelBackground);
  await expect(channel.getByRole('button', { name: 'Show New paid in chart' })).toBeVisible();
  await expect(channel.getByRole('button', { name: 'Expand New paid' })).toHaveCount(0);
});

test('empty breakdown messages stay visible while the table scrolls', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  const advisor = page.getByRole('button', { name: 'Expand James Walker', exact: true });
  await advisor.focus();
  await page.keyboard.press('Enter');
  const empty = page.getByRole('status', { name: 'James Walker breakdown', exact: true });
  await expect(empty).toHaveText('No acquisition channel data available.');
  const scroller = page.getByRole('region', {
    name: 'Monthly client figures, horizontally scrollable',
    exact: true,
  });
  if (isMobile) {
    for (const position of [0, 10000]) {
      await scroller.evaluate((element, left) => {
        element.scrollLeft = left;
      }, position);
      const bounds = await empty.boundingBox();
      const viewport = await scroller.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(viewport!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width + 1);
      expect(await empty.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({
    path: `.artifacts/dashboard-${isMobile ? 'mobile' : 'desktop'}-empty.png`,
    fullPage: true,
  });
});

test('plots real branch data and exposes conflicting totals in the keyboard tooltip', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Chart legend' }).getByRole('listitem')).toHaveText([
    'Branch 1',
    'Branch 2',
    'Branch 3',
  ]);
  const chart = page.getByRole('application', { name: 'Monthly clients for Company', exact: true });
  // Tab reaches the interactive chart directly, without stopping at its layout wrapper.
  await page.keyboard.press('Tab');
  await expect(chart).toBeFocused();
  const feb = page.getByRole('tooltip', { name: 'February 2024', exact: true });
  await expect(feb).toContainText('Branch 1147');
  await expect(feb).toContainText('Branch 276');
  await expect(feb).toContainText('Branch 327');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const may = page.getByRole('tooltip', { name: 'May 2024', exact: true });
  await expect(may).toContainText('Breakdown total279');
  await expect(may).toContainText('Reported total301');
  await expect(may).not.toContainText('Unexplained difference');
  await expectTooltipContained(page, 'May 2024');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', {
    name: 'Monthly client figures, horizontally scrollable', exact: true,
  })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(chart).toBeFocused();
  await expect(page.getByText('← → Explore chart', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expectTooltipContained(page, 'June 2024');
  await expect(page.getByText('← → Explore chart', { exact: true })).toBeHidden();
});

test('fits every month and tooltip for pointer, keyboard, and resizing', async ({ page, isMobile }) => {
  await page.goto('/');
  const chart = page.getByRole('application', { name: 'Monthly clients for Company', exact: true });
  const firstBar = chart.locator('.recharts-bar-rectangle path').first();
  if (isMobile) await firstBar.tap();
  else await firstBar.hover();
  await expectTooltipContained(page, 'February 2024');
  // End pointer interaction before keyboard checks; keep the pointer outside the chart during resize.
  await page.getByRole('heading', { name: 'Clients', exact: true }).click();
  await page.mouse.move(0, 0);
  await chart.focus();
  const months = [
    'March 2024', 'April 2024', 'May 2024', 'June 2024', 'July 2024', 'August 2024',
    'September 2024', 'October 2024', 'November 2024', 'December 2024', 'January 2025',
  ];
  for (const month of months) {
    await page.keyboard.press('ArrowRight');
    await expectTooltipContained(page, month);
  }
  const scroller = page.getByRole('region', {
    name: 'Chart data', exact: true,
  });
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBe(0);
  for (const position of [0, 10000]) {
    await scroller.evaluate((element, left) => { element.scrollLeft = left; }, position);
    await expectTooltipContained(page, 'January 2025');
  }
  for (const width of [375, 390, 430, 640, 768, 1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectTooltipContained(page, 'January 2025');
    await expect.poll(() => scroller.evaluate((element) => {
      const viewport = element.getBoundingClientRect();
      const segments = [...element.querySelectorAll('.recharts-bar-rectangle path')];
      return element.scrollWidth <= element.clientWidth && segments.length === 36
        && segments.every((segment) => {
          const bounds = segment.getBoundingClientRect();
          return bounds.width > 0 && bounds.left >= viewport.left
            && bounds.right <= viewport.right + 1;
        });
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: `.artifacts/tooltip-${isMobile ? 'touch' : 'mouse'}-375.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await expectTooltipContained(page, 'December 2024');
});

test('uses a compact table with three visible months and a sticky name column at 375px', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true }).click();
  const table = page.getByRole('table', { name: tableName });
  await expect(table.getByText('New paid', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  if (isMobile) {
    for (const action of await page.getByRole('button', { name: /^Show .* in chart$/ }).all()) {
      await expect(action).toHaveCSS('opacity', '1');
    }
    const scroller = page.getByRole('region', {
      name: 'Monthly client figures, horizontally scrollable',
      exact: true,
    });
    const viewport = await scroller.boundingBox();
    const nameColumn = await table.getByRole('columnheader').first().boundingBox();
    expect(nameColumn!.width).toBeLessThanOrEqual(viewport!.width / 2);
    const april = await table.getByRole('columnheader', { name: 'April 2024', exact: true }).boundingBox();
    expect(april!.x + april!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width);
    for (const row of await table.getByRole('row').all()) {
      expect((await row.boundingBox())!.height).toBe(44);
    }
    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const row = page.getByRole('button', { name: 'Collapse Anna Blackwood', exact: true });
    const bounds = await row.boundingBox();
    const container = await scroller.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(container!.x);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(container!.x + container!.width);
    const january = await scroller
      .getByRole('columnheader', { name: 'January 2025', exact: true })
      .boundingBox();
    expect(january!.x + january!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({
    path: `.artifacts/dashboard-${isMobile ? 'mobile' : 'desktop'}-expanded.png`,
    fullPage: true,
  });
});

test('has no detected WCAG A/AA violations with the hierarchy expanded', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true }).click();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('preserves Figma plot and table sizes in the default view', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The source Figma artboard is 1440 × 900.');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Expand Branch 1', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const figure = await page.getByRole('figure').boundingBox();
  expect(figure).toEqual({ x: 16, y: 84, width: 1408, height: 430 });
  const chartCard = await page.getByRole('region', { name: 'Company clients by branch', exact: true }).boundingBox();
  const table = page.getByRole('table', { name: tableName });
  expect(await table.boundingBox()).toEqual({ x: 16, y: chartCard!.y + chartCard!.height + 16, width: 1408, height: 280 });
  for (const row of await table.getByRole('row').all())
    expect((await row.boundingBox())!.height).toBe(56);
  const headers = await table.getByRole('columnheader').all();
  expect((await headers[1]!.boundingBox())!.width).toBe(92);
  expect((await headers.at(-1)!.boundingBox())!.width).toBe(108);
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toHaveCSS(
    'font-family',
    '"Inter Display", Inter, sans-serif',
  );
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toHaveCSS(
    'font-size',
    '35px',
  );
  const fonts = await page.evaluate(() => ({
    body: document.fonts.check('14px Inter'),
    title: document.fonts.check('35px "Inter Display"'),
  }));
  expect(fonts).toEqual({ body: true, title: true });
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: '.artifacts/dashboard-desktop.png', fullPage: true });
});

async function expectBarHeights(page: Page, values: readonly number[]) {
  const heights = await page.getByRole('application').evaluate((chart) => {
    const centers = [...chart.querySelectorAll('.recharts-xAxis-tick-labels text')]
      .map((tick) => {
        const bounds = tick.getBoundingClientRect();
        return bounds.x + bounds.width / 2;
      });
    const bars = [...chart.querySelectorAll('.recharts-bar-rectangle path')]
      .map((bar) => bar.getBoundingClientRect()).filter((bar) => bar.height > 0);
    return centers.map((center) => {
      const segments = bars.filter((bar) => Math.abs(bar.x + bar.width / 2 - center) < 1);
      return segments.length ? Math.max(...segments.map((bar) => bar.bottom))
        - Math.min(...segments.map((bar) => bar.top)) : 0;
    });
  });
  expect(heights).toHaveLength(12);
  const maximumHeight = Math.max(...heights);
  const maximumValue = Math.max(...values);
  for (let i = 0; i < values.length; i++) {
    expect(Math.abs(heights[i]! / maximumHeight * maximumValue - values[i]!)).toBeLessThan(1);
  }
}

test('selects every chart level with keyboard or touch, preserves expansion, and returns by breadcrumb', async ({ page, isMobile }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/clients')) requests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Company clients by branch' })).toBeVisible();
  const initialRequests = requests.length;
  await expectBarHeights(page, [250, 267, 284, 279, 317, 334, 350, 250, 250, 250, 250, 350]);
  const branch = page.getByRole('button', { name: 'Show Branch 1 in chart', exact: true });
  if (isMobile) await branch.tap();
  else {
    await branch.focus();
    await page.keyboard.press('Enter');
  }
  await expect(branch).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Expand Branch 1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toBeInViewport();
  await expectBarHeights(page, [147, 157, 166, 156, 188, 201, 216, 147, 147, 147, 147, 214]);
  const chart = page.getByRole('application', { name: 'Monthly clients for Branch 1' });
  await page.mouse.move(0, 0);
  await chart.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expectTooltipContained(page, 'August 2024');
  const august = page.getByRole('tooltip', { name: 'August 2024', exact: true });
  await expect(august).toContainText('Reported total214');
  await expect(august).toContainText('Breakdown total216');
  await expect(august).toContainText('Anna Blackwood38');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Show Anna Blackwood in chart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anna Blackwood clients by acquisition channel' })).toBeVisible();
  await expectBarHeights(page, [25, 26, 28, 30, 33, 35, 36, 28, 27, 27, 27, 38]);
  await expect(page.getByRole('list', { name: 'Chart legend' }).getByRole('listitem')).toHaveText([
    'Existing clients', 'New organic', 'New paid',
  ]);
  await mkdir('.artifacts', { recursive: true });
  await page.getByRole('heading', { name: 'Clients', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.artifacts/scope-advisor-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
  const annaChart = page.getByRole('application', { name: 'Monthly clients for Anna Blackwood' });
  await page.mouse.move(0, 0);
  await annaChart.focus();
  // Pointer movement during scrolling may leave a different month active before focus.
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expectTooltipContained(page, 'May 2024');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Expand Anna Blackwood', exact: true }).click();
  const paid = page.getByRole('button', { name: 'Show New paid in chart', exact: true });
  if (isMobile) await paid.tap();
  else {
    await paid.focus();
    await page.keyboard.press('Space');
  }
  await expect(page.getByRole('heading', { name: 'New paid clients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New paid clients' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'New paid clients' })).toBeInViewport();
  await expect(paid).toHaveAttribute('aria-pressed', 'true');
  await expectBarHeights(page, [0, 0, 1, 1, 2, 1, 0, 2, 1, 1, 1, 2]);
  const breadcrumbs = page.getByRole('navigation', { name: 'Chart scope' });
  await expect(breadcrumbs).toContainText('Company/Branch 1/Anna Blackwood/New paid');
  await page.getByRole('button', { name: 'Collapse Company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New paid clients' })).toBeVisible();
  await breadcrumbs.getByRole('button', { name: 'Branch 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toBeVisible();
  await breadcrumbs.getByRole('button', { name: 'Company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Company clients by branch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Company', exact: true })).toBeVisible();
  expect(requests).toHaveLength(initialRequests);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('charts sparse nodes, contains advisor tooltips, and keeps scope controls accessible', async ({ page, isMobile }) => {
  await page.goto('/');
  for (const name of ['Branch 2', 'Branch 3']) {
    await page.getByRole('button', { name: `Show ${name} in chart`, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${name} clients`, exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Chart legend' })).toHaveText(name);
    await expect(page.getByRole('complementary', { name: 'Data differences' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Expand Branch 1', exact: true }).click();
  await page.getByRole('button', { name: 'Show James Walker in chart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'James Walker clients', exact: true })).toBeVisible();
  await expectBarHeights(page, [12, 13, 14, 14, 15, 15, 16, 12, 12, 12, 12, 17]);
  await page.getByRole('button', { name: 'Show Branch 1 in chart', exact: true }).click();
  const chart = page.getByRole('application', { name: 'Monthly clients for Branch 1' });
  const firstBar = chart.locator('.recharts-bar-rectangle path').first();
  if (isMobile) await firstBar.tap();
  else await firstBar.hover();
  await expectTooltipContained(page, 'February 2024');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
