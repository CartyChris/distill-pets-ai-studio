import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ['--no-sandbox'],
});
const sizes = [
  [320, 568], [375, 667], [390, 844], [393, 852], [412, 915],
  [420, 912], [430, 932], [568, 320], [852, 393], [932, 430],
  [768, 1024], [1024, 768], [1280, 720], [1440, 900],
];
async function selectView(page, view) {
  const button = page.locator(`[data-page="${view}"]:visible`).first();
  if (await button.count()) return button.click();
  await page.getByRole('button', {name:'All views',exact:true}).filter({visible:true}).first().click();
  await page.locator('#modal').locator(`[data-page="${view}"]`).click();
}
const failures = [];
const rows = [];
let inspected = 0;

for (const [width, height] of sizes) {
  const touch = width < 1000;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: touch,
    hasTouch: touch,
  });
  const page = await context.newPage();
  const faults = [];
  page.on('pageerror', e => faults.push(e.message));
  await page.goto(process.env.APP_URL || 'http://localhost:5174');
  await page.getByRole('button', { name: 'Try the playground', exact: true }).first().click();
  const pages = await page.locator('.mobile-nav [data-page]').evaluateAll(
    buttons => buttons.map(button => button.dataset.page)
  );
  for (const view of pages) {
    await selectView(page, view);
    const result = await page.evaluate(() => {
      const visible = element => element.getBoundingClientRect().width > 0;
      const controls = [...document.querySelectorAll('.page button, .stage-head button, .mobile-nav button')]
        .filter(visible)
        .map(element => ({
          label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 50),
          height: element.getBoundingClientRect().height,
          width: element.getBoundingClientRect().width,
        }))
        .filter(control => control.height < 43.9 || control.width < 43.9);
      const textFields = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select')]
        .filter(visible)
        .map(element => ({ id: element.id, font: parseFloat(getComputedStyle(element).fontSize) }))
        .filter(element => element.font < 16);
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        mobile: getComputedStyle(document.querySelector('.mobile-nav')).display !== 'none',
        controls,
        textFields,
        navHeight: document.querySelector('.mobile-nav').getBoundingClientRect().height,
        activeNavVisible: (() => {
          const button = document.querySelector('.mobile-nav [aria-current="page"]');
          if (!button) return true;
          const active = button.getBoundingClientRect();
          return active.left >= -1 && active.right <= innerWidth + 1;
        })(),
      };
    });
    inspected++;
    if (result.overflow > 1) failures.push(`${width}×${height} ${view}: overflow ${result.overflow}px`);
    if (result.mobile && result.controls.length) failures.push(`${width}×${height} ${view}: small controls ${JSON.stringify(result.controls)}`);
    if (touch && result.textFields.length) failures.push(`${width}×${height} ${view}: small editable text ${JSON.stringify(result.textFields)}`);
    if (result.mobile && result.navHeight >= 90) failures.push(`${width}×${height} ${view}: navigation ${result.navHeight}px`);
    if (result.mobile && !result.activeNavVisible) failures.push(`${width}×${height} ${view}: active navigation is outside the viewport`);
  }

  if (width <= 430) {
    await page.locator('.mobile-nav [data-page="code"]').click();
    await page.getByLabel('Build something').fill('Build a small counter app.');
    await page.getByRole('button', { name: 'Build project', exact: true }).click();
    await page.getByText('Project ready', { exact: true }).waitFor();
    await page.locator('#code-preview').scrollIntoViewIfNeeded();
    await page.frameLocator('#code-preview').getByRole('button', { name: 'Add a little joy', exact: true }).click();
    assert.equal(await page.frameLocator('#code-preview').locator('#count').textContent(), '1');
    const workbench = await page.locator('.workbench').boundingBox();
    const editor = await page.getByLabel('Code editor').boundingBox();
    assert.ok(workbench.width >= width - 34, 'Workbench should use the available phone width');
    assert.ok(editor.width > width * 0.7, 'Phone editor should use the full-width file-strip layout');

    await page.evaluate(() => {
      const toolbar = document.createElement('div');
      toolbar.id = 'test-host-toolbar';
      toolbar.setAttribute('popover', 'manual');
      toolbar.style.cssText = 'position:fixed;inset:auto 0 0;width:100%;height:64px;margin:0;border:0;background:#222;color:white;';
      toolbar.textContent = 'Host toolbar test';
      document.body.append(toolbar);
      toolbar.showPopover();
    });
    const offsets = await page.evaluate(() => {
      const nav = document.querySelector('.mobile-nav').getBoundingClientRect();
      const toolbar = document.querySelector('#test-host-toolbar').getBoundingClientRect();
      return { navBottom: nav.bottom, toolbarTop: toolbar.top };
    });
    assert.ok(offsets.navBottom <= offsets.toolbarTop + 1, 'Host toolbar must not cover navigation');
    await page.locator('.mobile-nav [data-page="settings"]').click();
    await page.getByLabel('OpenRouter API key').fill('phone-layout-test');
    const focusedFont = await page.getByLabel('OpenRouter API key').evaluate(element => getComputedStyle(element).fontSize);
    assert.equal(focusedFont, '16px');
    if ([320, 393, 420, 430].includes(width)) {
      await page.screenshot({ path: `tests/responsive-${width}.png`, fullPage: true });
    }
  }
  if (width === 1440) {
    await page.locator('.sidebar nav [data-page="workspace"]').click();
    await page.screenshot({ path: 'tests/responsive-laptop.png', fullPage: true });
  }
  if (faults.length) failures.push(`${width}×${height}: browser errors ${faults.join('; ')}`);
  rows.push(`${width}×${height}`);
  await context.close();
}

// Push the real appearance controls and longest valid names, not only defaults.
for (const [width, height] of [[320, 568], [420, 912], [852, 393], [1280, 720]]) {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
  const page = await context.newPage();
  await page.goto(process.env.APP_URL || 'http://localhost:5174');
  await page.getByRole('button', { name: 'Try the playground', exact: true }).first().click();
  const go = view => selectView(page, view);
  await go('customize');
  for (const [id, value] of [['scale', '1.2'], ['density', 'spacious'], ['font', 'mono']]) {
    await page.locator(`#custom-${id}`).selectOption(value);
  }
  for (const agent of ['milo', 'nova']) {
    await page.locator(`#custom-name-${agent}`).fill('W'.repeat(40));
    await page.locator(`#custom-name-${agent}`).blur();
  }
  const pages = await page.locator('.mobile-nav [data-page]').evaluateAll(buttons => buttons.map(button => button.dataset.page));
  for (const view of pages) {
    await go(view);
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      clipped: [...document.querySelectorAll('.row h2, .row h3, .check')]
        .filter(element => element.getBoundingClientRect().width > 0 && element.scrollWidth > element.clientWidth + 1)
        .map(element => element.textContent.trim().slice(0, 50)),
      smallText: [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select')]
        .filter(element => element.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(element).fontSize) < 16)
        .map(element => element.id),
    }));
    inspected++;
    if (result.overflow > 1 || result.clipped.length || (touch && result.smallText.length)) {
      failures.push(`${width}×${height} ${view}, largest/roomy/mono/long names: ${JSON.stringify(result)}`);
    }
  }
  if (width === 320) {
    await go('workspace');
    await page.screenshot({ path: 'tests/responsive-largest-320.png', fullPage: true });
  }
  await context.close();
}

await browser.close();
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`PASS: ${inspected} view/viewport combinations across ${rows.join(', ')}; touch targets, editable text, code preview, host toolbar separation, and maximum text/spacing with long names.`);
