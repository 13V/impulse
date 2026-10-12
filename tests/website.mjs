import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const baseURL = process.env.IMPULSE_BASE_URL || 'http://localhost:5174';
const firstVehicleRoute = '/stock/bmw-m4-coupe';
const firstVehicleName = '2016 BMW M4 Coupé';
const galleryVehicleRoute = '/stock/mercedes-amg-g-class';
const screenshotDir = resolve(process.env.IMPULSE_SCREENSHOT_DIR || '.screenshots');
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.IMPULSE_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(5000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
const mutationRequests = [];
page.on('request', request => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
    mutationRequests.push({ method: request.method(), url: request.url() });
  }
});
const results = [];
async function check(name, work) {
  try { await work(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const cards = () => page.locator('.stock-grid .car-card');
const status = value => page.locator('.stock-tabs button').filter({ hasText: new RegExp(`^${value}`) });
const reset = () => page.locator('.filter-applied button').click();
const goStock = () => page.goto(`${baseURL}/stock`);
const screenshot = name => page.screenshot({ path: resolve(screenshotDir, name), fullPage: true });

try {
  await page.goto(baseURL);
  await check('Impulse branding and verified Elizabeth South contact details', async () => {
    await expect(page.locator('.header .brand')).toHaveAttribute('aria-label', /Impulse Automotive home/i);
    await expect(page.locator('.footer')).toContainText('183 Philip');
    await expect(page.locator('.footer')).toContainText('Elizabeth South');
    await expect(page.locator('.footer')).toContainText('5112');
    const callLinks = page.locator('a[href^="tel:"]');
    expect(await callLinks.count()).toBeGreaterThan(0);
    for (const href of await callLinks.evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      expect(href).toBe('tel:+61424566439');
    }
    await expect(page.locator('body')).toContainText('0424 566 439');
    const maps = page.locator('a[href*="google.com/maps"]').first();
    await expect(maps).toBeAttached();
    const mapURL = new URL(await maps.getAttribute('href'));
    expect(mapURL.searchParams.get('query')).toMatch(/183.*Philip.*Elizabeth South.*5112/i);
    await expect(page.locator('a[href="https://www.facebook.com/impulseautomotivesales/"]').first()).toBeAttached();
    await expect(page.locator('body')).not.toContainText(/MM Presti[e]?ge|Wingfield|0411 710 409/);
  });
  await check('Example stock and photographs are clearly disclosed', async () => {
    await expect(page.locator('.sample-note')).toContainText('Example inventory');
    await expect(page.locator('.sample-note')).toContainText('illustrative');
    await page.goto(`${baseURL}${firstVehicleRoute}`);
    await expect(page.locator('.gallery-note')).toContainText('Illustrative model photography');
    await expect(page.locator('.gallery-note')).toContainText('not current showroom vehicles');
    await expect(page.locator('.detail-note')).toContainText('sample data');
    await expect(page.locator('.vehicle-price')).toContainText('Sample price');
    await expect(page.locator('.finance p')).toContainText('not a finance offer');
    await page.goto(baseURL);
  });
  await check('The customer website has no CRM, stock-manager or palette navigation', async () => {
    await expect(page.locator('a[href^="/crm"], a[href^="/stock-manager"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Compare colour palettes' })).toHaveCount(0);
    for (const route of ['/crm', '/stock-manager']) {
      await page.goto(`${baseURL}${route}`);
      await expect(page.locator('.not-found')).toBeVisible();
      await expect(page.locator('.not-found h1')).toBeVisible();
      await expect(page.locator('.not-found').getByRole('link', { name: /Explore our stock/ })).toBeVisible();
      await expect(page.getByText('Interactive mockup', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Interactive concept', { exact: true })).toHaveCount(0);
    }
    await page.goto(baseURL);
  });
  await check('Home hero search carries make, model and budget into matching stock', async () => {
    const search = page.getByRole('form', { name: 'Find a car' });
    await search.getByRole('combobox', { name: 'Car make', exact: true }).selectOption('BMW');
    await search.getByRole('combobox', { name: 'Car model', exact: true }).selectOption('M4 Coupé');
    await search.getByRole('combobox', { name: 'Car budget', exact: true }).selectOption('100000');
    await search.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/\/stock\?/);
    const query = new URL(page.url()).searchParams;
    expect(query.get('make')).toBe('BMW');
    expect(query.get('model')).toBe('M4 Coupé');
    expect(query.get('max')).toBe('100000');
    await expect(cards()).toHaveCount(1);
    await expect(cards().first().locator('.card-title')).toHaveText('BMW M4 Coupé');
    await expect(cards().first().locator('.card-title')).toHaveAttribute('href', firstVehicleRoute);
    await expect(page.getByRole('textbox', { name: 'Search stock' })).toHaveValue('M4 Coupé');
    await expect(page.getByRole('checkbox', { name: /^BMW/ })).toBeChecked();
    await expect(page.getByRole('combobox', { name: /^Maximum price/ })).toHaveValue('100000');
    await page.goto(baseURL);
  });
  await check('Home collection browses featured cars and switches stock availability', async () => {
    const tabs = page.getByRole('group', { name: 'Featured stock availability' });
    const featuredCards = page.locator('.featured .car-card');
    const previous = page.getByRole('button', { name: 'Previous featured cars', exact: true });
    const next = page.getByRole('button', { name: 'Next featured cars', exact: true });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(featuredCards.first().locator('.card-title')).toHaveText('BMW M4 Coupé');
    await next.click();
    await expect(featuredCards).toHaveCount(4);
    await expect(featuredCards.first().locator('.card-title')).toHaveText('BMW 6 Series Gran Coupé');
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(featuredCards.first().locator('.card-title')).toHaveText('BMW M4 Coupé');
    await expect(previous).toBeDisabled();
    await tabs.getByRole('button', { name: 'Sold cars', exact: true }).click();
    await expect(tabs.getByRole('button', { name: 'Sold cars', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(featuredCards).toHaveCount(2);
    await expect(page.locator('.featured .sold-tag')).toHaveCount(2);
    await expect(previous).toBeDisabled();
    await expect(next).toBeDisabled();
    await tabs.getByRole('button', { name: 'All cars', exact: true }).click();
    await expect(tabs.getByRole('button', { name: 'All cars', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(featuredCards).toHaveCount(4);
    await tabs.getByRole('button', { name: 'In stock', exact: true }).click();
    await expect(tabs.getByRole('button', { name: 'In stock', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(featuredCards).toHaveCount(4);
    await expect(page.locator('.featured .sold-tag')).toHaveCount(0);
  });
  await check('Header contact action opens and closes the enquiry', async () => {
    await page.locator('.header-actions').getByRole('button', { name: 'Contact us', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Enquire with Impulse Automotive' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
  await check('Home page and stock links', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find your dream car');
    await expect(page).toHaveTitle(/Impulse Automotive/);
    await expect(page.locator('.featured .car-card')).toHaveCount(4);
    await page.getByRole('link', { name: 'Explore our stock', exact: true }).click();
    await expect(page).toHaveURL(/\/stock$/);
    await expect(cards()).toHaveCount(6);
  });
  await check('Available, sold and all stock', async () => {
    await status('Sold').click();
    await expect(cards()).toHaveCount(2);
    await expect(page.locator('.stock-grid .sold-tag')).toHaveCount(2);
    await status('All cars').click();
    await expect(cards()).toHaveCount(8);
    await status('Available').click();
    await expect(cards()).toHaveCount(6);
  });
  await check('Search and reset', async () => {
    await page.getByRole('textbox', { name: 'Search stock' }).fill('Polo');
    await expect(cards()).toHaveCount(1);
    await expect(cards().first()).toContainText('Polo GTI');
    await page.getByRole('textbox', { name: 'Search stock' }).fill('no-such-car');
    await expect(cards()).toHaveCount(0);
    await expect(page.getByText('No cars in this lane.')).toBeVisible();
    await reset();
    await expect(cards()).toHaveCount(6);
  });
  await check('Make filter', async () => {
    await page.getByRole('checkbox', { name: /^BMW/ }).check();
    await expect(cards()).toHaveCount(4);
    for (const text of await cards().allTextContents()) expect(text).toContain('BMW');
    await reset();
  });
  await check('Transmission and maximum price filters', async () => {
    await page.getByRole('combobox', { name: /^Transmission/ }).selectOption('Manual');
    await expect(cards()).toHaveCount(1);
    await expect(cards().first()).toContainText('Polo GTI');
    await page.getByRole('combobox', { name: /^Transmission/ }).selectOption('Automatic');
    await expect(cards()).toHaveCount(5);
    await page.getByRole('combobox', { name: /^Maximum price/ }).selectOption('60000');
    await expect(cards()).toHaveCount(1);
    await expect(cards().first()).toContainText('BMW i8');
    await reset();
  });
  await check('Body style filter', async () => {
    await page.getByLabel('Coupe', { exact: true }).check();
    await expect(cards()).toHaveCount(2);
    await page.getByRole('button', { name: 'All body styles', exact: true }).click();
    await expect(cards()).toHaveCount(6);
  });
  await check('Sorting by price and kilometres', async () => {
    await page.getByLabel('Sort stock').selectOption('price-low');
    const prices = await page.locator('.stock-grid .card-bottom strong').allTextContents();
    expect(prices.map(s => +s.replace(/\D/g, ''))).toEqual([24990, 57990, 64990, 69990, 94990, 179990]);
    await page.getByLabel('Sort stock').selectOption('price-high');
    await expect(cards().first()).toContainText('Mercedes-AMG G-Class');
    await page.getByLabel('Sort stock').selectOption('kms');
    await expect(cards().first().locator('.card-title')).toHaveText('BMW i8');
    await expect(cards().first().locator('.card-variant')).toContainText('2017');
    await page.getByLabel('Sort stock').selectOption('newest');
  });
  await check('Save a car and persist saved state', async () => {
    const firstSave = cards().first().getByRole('button', { name: /^Save / });
    await firstSave.click();
    await expect(cards().first().getByRole('button', { name: /^Unsave / })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await page.locator('.saved-button').click();
    await expect(cards()).toHaveCount(1);
    await expect(cards().first().locator('.card-title')).toHaveText('Mercedes-AMG G-Class');
    await expect(cards().first().locator('.card-variant')).toContainText('2019');
    await page.locator('.saved-button').click();
    await expect(cards()).toHaveCount(6);
  });
  await check('Vehicle detail and carousel', async () => {
    await page.goto(`${baseURL}${firstVehicleRoute}`);
    await expect(page.locator('.vehicle-summary h1')).toHaveText('M4 Coupé');
    await expect(page.locator('.gallery-count')).toHaveText('01 / 01');
    await expect(page.getByRole('button', { name: 'Next vehicle photo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Previous vehicle photo', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand vehicle photos', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Vehicle photo gallery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next expanded photo', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto(`${baseURL}${galleryVehicleRoute}`);
    await expect(page.locator('.vehicle-summary h1')).toHaveText('G-Class');
    await expect(page.locator('.gallery-count')).toHaveText('01 / 02');
    await expect(page.locator('.gallery-main img')).toHaveAttribute('src', '/images/detail-1.jpg');
    await page.getByRole('button', { name: 'Next vehicle photo', exact: true }).click();
    await expect(page.locator('.gallery-count')).toHaveText('02 / 02');
    await expect(page.locator('.gallery-main img')).toHaveAttribute('src', '/images/detail-3.jpg');
    await page.getByRole('button', { name: 'Previous vehicle photo', exact: true }).click();
    await expect(page.locator('.gallery-count')).toHaveText('01 / 02');
    await page.getByRole('button', { name: 'Previous vehicle photo', exact: true }).click();
    await expect(page.locator('.gallery-count')).toHaveText('02 / 02');
    await page.getByRole('button', { name: 'Show vehicle photo 1', exact: true }).click();
    await expect(page.locator('.gallery-count')).toHaveText('01 / 02');
    await expect(page.getByRole('button', { name: 'Show vehicle photo 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Show vehicle photo 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
  await check('Expanded gallery, keyboard arrows and Escape', async () => {
    await page.getByRole('button', { name: 'Expand vehicle photos', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Vehicle photo gallery' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.lightbox-controls span')).toHaveText('2 / 2');
    await page.getByRole('button', { name: 'Previous expanded photo' }).click();
    await expect(page.locator('.lightbox-controls span')).toHaveText('1 / 2');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.lightbox-controls span')).toHaveText('2 / 2');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  await check('Overview and specification tabs', async () => {
    await page.goto(`${baseURL}${firstVehicleRoute}`);
    await page.getByRole('tab', { name: 'Specifications' }).click();
    await expect(page.getByRole('tab', { name: 'Specifications' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#specifications-panel')).toContainText('317 kW');
    await expect(page.locator('#specifications-panel')).toContainText('3.0L twin-turbo inline-six');
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.locator('#overview-panel')).toBeVisible();
  });
  await check('Repayment calculator updates at zero interest', async () => {
    await page.locator('.finance-toggle').click();
    await page.getByLabel('Deposit', { exact: true }).fill('20000');
    await page.getByRole('combobox', { name: /^Term/ }).selectOption('3');
    await page.getByLabel('Annual interest rate').fill('0');
    const weekly = Math.round((94990 - 20000) / 36 * 12 / 52);
    await expect(page.locator('.finance-toggle b')).toHaveText(`$${weekly} / week`);
    await expect(page.locator('.finance p')).toContainText('3-year term, 0% p.a., $20,000 deposit');
  });
  await check('Enquiry preparation and SMS link', async () => {
    await page.getByRole('button', { name: 'Enquire about this car', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Enquire with Impulse Automotive' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Your name').fill('Website QA');
    await dialog.getByLabel('Phone number').fill('0400000000');
    await expect(dialog.getByLabel('Your message')).toHaveValue(new RegExp(firstVehicleName));
    await dialog.getByRole('button', { name: 'Prepare enquiry' }).click();
    await expect(dialog.getByText('Your message is ready.')).toBeVisible();
    const href = await dialog.getByRole('link', { name: 'Send via SMS' }).getAttribute('href');
    expect(href.startsWith('sms:+61424566439?body=')).toBeTruthy();
    const message = decodeURIComponent(href.split('?body=')[1]);
    expect(message).toContain(firstVehicleName);
    expect(message).toContain('Name: Website QA');
    expect(message).toContain('Phone: 0400000000');
    await dialog.getByRole('button', { name: 'Edit your message' }).click();
    await expect(dialog.getByLabel('Your name')).toHaveValue('Website QA');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  await check('Sold vehicle hides price and offers similar cars', async () => {
    await page.goto(`${baseURL}/stock/volkswagen-polo-gti-sold`);
    await expect(page.locator('.sold-word')).toHaveText('SOLD');
    await expect(page.locator('.finance')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Find me something similar' })).toBeVisible();
  });
  await check('Footer story link scrolls from stock to about', async () => {
    await goStock();
    await page.locator('.footer').getByRole('link', { name: 'Our story', exact: true }).click();
    await expect(page).toHaveURL(/\/#about$/);
    await page.waitForTimeout(600);
    const rect = await page.locator('#about').boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeLessThan(200);
  });
  await check('Keyboard enquiry traps focus, shows focus and returns to its trigger', async () => {
    await page.goto(`${baseURL}${firstVehicleRoute}`);
    const trigger = page.getByRole('button', { name: 'Enquire about this car', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Enquire with Impulse Automotive' });
    const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
    await expect(close).toBeFocused();
    const outline = await close.evaluate(element => {
      const style = getComputedStyle(element);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.width).toBeGreaterThan(0);
    expect(outline.style).not.toBe('none');
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: /^Prefer to call\?/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  await check('Reduced-motion preference disables smooth scrolling and makes image transitions instant', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseURL);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBeTruthy();
    expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('auto');
    const motion = await page.locator('.featured .car-card img').first().evaluate(element => {
      const style = getComputedStyle(element);
      return { transition: style.transitionDuration, animation: style.animationName };
    });
    // A duration up to 0.1ms preserves transition events without visible motion.
    expect(motion.transition.split(',').every(duration => parseFloat(duration) <= 0.0001)).toBeTruthy();
    expect(motion.animation).toBe('none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await page.goto(baseURL);
  await screenshot('home-desktop.png');
  await goStock();
  await screenshot('stock-desktop.png');
  await page.goto(`${baseURL}${firstVehicleRoute}`);
  await screenshot('vehicle-desktop.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  await check('Mobile navigation opens, navigates and closes', async () => {
    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await toggle.click();
    const close = page.getByRole('button', { name: 'Close navigation' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    const controls = await close.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(page.locator('.nav')).toHaveAttribute('id', controls);
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.locator('.nav').getByRole('link', { name: 'Inventory', exact: true }).click();
    await expect(page).toHaveURL(/\/stock$/);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  });
  await check('Mobile navigation closes on sold query navigation', async () => {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.locator('.nav').getByRole('link', { name: 'Sold cars', exact: true }).click();
    await expect(page).toHaveURL(/\/stock\?status=sold$/);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  });
  await goStock();
  await check('Mobile filters show results and reset', async () => {
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.locator('.filters')).toHaveClass(/filters-open/);
    await page.getByRole('checkbox', { name: /^Volkswagen/ }).check();
    await page.getByRole('button', { name: 'Show 1 cars', exact: true }).click();
    await expect(page.locator('.filters')).not.toHaveClass(/filters-open/);
    await expect(cards()).toHaveCount(1);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await reset();
    await page.getByRole('button', { name: 'Show 6 cars', exact: true }).click();
    await expect(cards()).toHaveCount(6);
  });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
    for (const [name, route] of [['home', '/'], ['stock', '/stock'], ['vehicle', firstVehicleRoute]]) {
      await check(`No horizontal overflow on ${name} at ${width}px`, async () => {
        await page.goto(`${baseURL}${route}`);
        await page.waitForTimeout(250);
        const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
        await screenshot(`${name}-${width}.png`);
      });
    }
  }
  await check('Stock has three generous columns and a usable sidebar on a wide screen', async () => {
    await page.setViewportSize({ width: 2493, height: 1265 });
    await goStock();
    const layout = await page.locator('.stock-layout').boundingBox();
    const sidebar = await page.locator('.filters').boundingBox();
    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.x).toBeLessThanOrEqual(2493 * 0.1);
    expect(layout.x + layout.width).toBeLessThanOrEqual(2493);
    expect(sidebar.width).toBeGreaterThanOrEqual(220);
    expect(sidebar.x).toBeGreaterThanOrEqual(layout.x);
    const first = await cards().nth(0).boundingBox();
    const third = await cards().nth(2).boundingBox();
    expect(first.width).toBeGreaterThan(350);
    expect(first.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
    expect(third.x + third.width).toBeLessThanOrEqual(layout.x + layout.width);
    expect(third.y).toBe(first.y);
  });
  await check('Vehicle gallery and summary remain generous on a wide screen', async () => {
    await page.setViewportSize({ width: 2493, height: 1265 });
    await page.goto(`${baseURL}/stock/bmw-6-series-gran-coupe`);
    const gallery = await page.locator('.gallery-main').boundingBox();
    const summary = await page.locator('.vehicle-summary').boundingBox();
    expect(gallery.x).toBeGreaterThanOrEqual(0);
    expect(gallery.x).toBeLessThanOrEqual(2493 * 0.05);
    expect(gallery.width).toBeGreaterThan(1000);
    expect(summary.width).toBeGreaterThan(400);
    expect(gallery.x + gallery.width).toBeLessThanOrEqual(summary.x);
    expect(2493 - summary.x - summary.width).toBeGreaterThanOrEqual(0);
    expect(2493 - summary.x - summary.width).toBeLessThanOrEqual(2493 * 0.05);
  });
  await check('All local images load', async () => {
    for (const route of ['/', '/stock?status=all', firstVehicleRoute, galleryVehicleRoute]) {
      await page.goto(`${baseURL}${route}`);
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const missing = await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
      expect(missing).toEqual([]);
      const imageURLs = await page.locator('img').evaluateAll(images => images.map(image => image.src));
      for (const imageURL of imageURLs) expect(new URL(imageURL).origin).toBe(new URL(baseURL).origin);
    }
  });
  await check('The customer preview makes no real mutation requests', async () => { expect(mutationRequests).toEqual([]); });
  await check('No browser runtime errors', async () => { expect(runtimeErrors).toEqual([]); });
} finally {
  await writeFile(resolve(screenshotDir, 'functional-results.json'), JSON.stringify({ baseURL, results, runtimeErrors, mutationRequests }, null, 2));
  await browser.close();
}
const failed = results.filter(result => !result.passed);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
