import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.APP_URL || 'http://localhost:5190';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const faults = [], calls = [], externalAssets = [];
page.on('pageerror', error => faults.push(error.message));
page.on('request', request => {
  if (request.url().includes('/api/complete')) calls.push(request.postDataJSON());
  if (request.url().includes('forge-attacker.invalid')) externalAssets.push(request.url());
});
const action = (name, extra = '') => page.locator(`[data-action="${name}"]${extra}:visible`).first();
const nav = name => action('page', `[data-page="${name}"]`).click();
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('pip-studio-v1')));
const source = () => page.getByLabel('Editable Mermaid source', { exact: true });
const download = async (name, expected, output) => {
  const [file] = await Promise.all([page.waitForEvent('download'), action(name).click()]);
  assert.equal(file.suggestedFilename(), expected);
  await file.saveAs(output);
  return fs.readFile(output);
};

try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Try the playground', exact: true }).first().click();
  await nav('forge');
  await page.locator('#forge-diagram-mount>svg').waitFor({ timeout: 30000 });
  await page.getByText('Parsed and rendered locally with Mermaid. Source is the editable original.', { exact: true }).waitFor();
  assert.ok((await source().inputValue()).includes('Teacher'));

  if (new URL(base).hostname === 'localhost' || new URL(base).hostname === '127.0.0.1') {
    await page.route('**forge-attacker.invalid/**', route => route.abort());
    const result = await page.evaluate(async () => {
      const { sanitizeForgeSVG } = await import('/src/forge.js');
      const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" xml:base="https://forge-attacker.invalid/rebase" style="background-image:image-set(\'https://forge-attacker.invalid/image-set\' 1x)"><defs><marker id="arrow"><path d="M0 0L2 2"/></marker></defs><style>.safe{fill:url(#arrow)}.bad{fill:url(https://forge-attacker.invalid/style)}@font-face{font-family:bad;src:url(https://forge-attacker.invalid/font)}</style><rect width="10" height="10" fill="url(https://forge-attacker.invalid/fill)" filter="url(https://forge-attacker.invalid/filter)" clip-path="url(https://forge-attacker.invalid/clip)" mask="url(https://forge-attacker.invalid/mask)" marker-start="url(https://forge-attacker.invalid/marker)" marker-end="url(#arrow)" stroke="url(#arrow)" onload="alert(1)"/><image href="https://forge-attacker.invalid/image"/><script>alert(1)</script></svg>';
      const clean = await sanitizeForgeSVG(raw);
      const holder = document.createElement('div'); holder.innerHTML = clean; document.body.append(holder); holder.getBoundingClientRect();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      holder.remove();
      return clean;
    });
    assert.equal(result.includes('forge-attacker.invalid'), false, 'SVG presentation attributes and styles must remove external URL references');
    assert.equal(result.includes('onload'), false);
    assert.equal(result.includes('xml:base'), false, 'Local fragment references must not be rebased onto a remote document');
    assert.equal(result.includes('<script'), false);
    assert.equal(result.includes('<image'), false);
    assert.ok(result.includes('url(#arrow)'), 'Safe local fragment references must remain available');
    assert.equal(externalAssets.length, 0, 'Attaching sanitized SVG must not fetch image-set, font, or paint URLs');
  }

  await action('forge-template', '[data-template="sequence"]').click();
  await page.locator('#forge-diagram-mount').getByText('Send a task', { exact: true }).waitFor();
  await page.getByLabel('Diagram zoom', { exact: true }).selectOption('2');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Diagram zoom must stay inside its scroll container');
  const validSVG = await download('forge-svg', 'pip-diagram.svg', 'tests/forge-valid.svg');
  assert.ok(validSVG.toString().startsWith('<svg'));
  const png = await download('forge-png', 'pip-diagram.png', 'tests/forge-valid.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG must be an actual raster export');
  const priorSVG = await page.locator('#forge-diagram-mount').innerHTML();
  const invalidDiagram = 'flowchart LR\n A["An unfinished node"';
  await source().fill(invalidDiagram);
  await action('forge-diagram-render').click();
  await page.locator('#forge-diagram-error:not([hidden])').waitFor();
  assert.equal(await page.locator('#forge-diagram-mount').innerHTML(), priorSVG, 'Parser failure keeps the last real diagram');
  const mmd = await download('forge-source', 'pip-diagram.mmd', 'tests/forge-invalid-source.mmd');
  assert.equal(mmd.toString(), invalidDiagram, 'Source export remains authoritative even when invalid');
  await source().fill('flowchart LR\n A@{img:"https://forge-attacker.invalid/source"}');
  await action('forge-diagram-render').click();
  await page.getByText('External images, embedded markup, and CSS URL assets are disabled. Use native Mermaid shapes and text.', { exact: true }).waitFor();
  assert.equal(externalAssets.length, 0);
  await action('forge-template', '[data-template="workflow"]').click();
  await page.locator('#forge-diagram-mount').getByText('Write a clear brief', { exact: true }).waitFor();

  // Real prepared backend generation follows the same parsing/rendering path.
  await page.getByLabel('What should the diagram show?', { exact: true }).fill('Show a simple teacher example and a learner test.');
  await action('forge-generate', '[data-kind="diagram"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).forge.generation.status === 'complete');
  assert.equal((await stored()).forge.generation.demo, true);
  await page.screenshot({ path: 'tests/forge-diagram-desktop.png', fullPage: true });

  await action('forge-tab', '[data-tab="ui"]').click();
  await page.locator('#forge-ui-preview').getByRole('heading', { name: 'My tiny learning dashboard', exact: true }).waitFor();
  const checklist = page.locator('#forge-ui-preview').getByLabel('Check the facts', { exact: true });
  await checklist.check();
  await page.reload();
  await nav('forge');
  assert.equal(await page.locator('#forge-ui-preview').getByLabel('Check the facts', { exact: true }).isChecked(), true);
  const jsonEditor = page.getByLabel('Editable UI JSON', { exact: true });
  const previousPreview = await page.locator('#forge-ui-preview').innerHTML();
  await jsonEditor.fill('{"version":1,"title":"Untrusted HTML","blocks":[{"type":"html","body":"<script>alert(1)</script>"}]}');
  await action('forge-ui-apply').click();
  await page.locator('#forge-ui-error:not([hidden])').waitFor();
  assert.equal(await page.locator('#forge-ui-preview').innerHTML(), previousPreview);
  await jsonEditor.fill('{"version":1,"title":"Plain text remains text","blocks":[{"type":"notice","body":"<img src=x onerror=alert(1)>"}]}');
  await action('forge-ui-apply').click();
  assert.equal(await page.locator('#forge-ui-preview img').count(), 0);
  assert.ok((await page.locator('#forge-ui-preview').innerText()).includes('<img src=x onerror=alert(1)>'));
  await action('forge-template', '[data-template="brief"]').click();
  await page.locator('#forge-ui-preview').getByLabel('My goal', { exact: false }).fill('Explain why leaves change color.');
  await page.locator('#forge-ui-preview').getByLabel('Who is it for?', { exact: false }).fill('A curious seven-year-old');
  await page.locator('#forge-ui-preview').getByLabel('Tone', { exact: true }).selectOption('Warm');
  const beforePrepare = calls.length;
  await action('forge-ui-form').click();
  assert.ok((await page.getByLabel('Your task', { exact: true }).inputValue()).includes('A curious seven-year-old'));
  assert.equal(calls.length, beforePrepare, 'Native UI actions must not silently call models');
  await nav('forge');
  await page.getByLabel('What should this interface do?', { exact: true }).fill('Create a compact learning dashboard with a clear practice notice.');
  await action('forge-generate', '[data-kind="ui"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).forge.generation.status === 'complete');
  const schemaFile = await download('forge-json', 'pip-ui-schema.json', 'tests/forge-schema.json');
  assert.equal(JSON.parse(schemaFile).version, 1);

  // An imported workspace cannot inherit a previous workspace's rendered SVG.
  const replacement = await stored();
  replacement.forge.tab = 'diagram'; replacement.forge.diagramSource = invalidDiagram; replacement.forge.lastDiagramSource = ''; replacement.forge.diagramError = '';
  await nav('settings');
  await page.getByRole('button', { name: 'Import workspace', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'forge-import-check.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await page.getByRole('button', { name: 'Import this backup', exact: true }).click();
  await nav('forge');
  await page.locator('#forge-diagram-error:not([hidden])').waitFor();
  assert.equal(await page.locator('#forge-diagram-mount svg').count(), 0, 'Imported invalid source must not expose the prior workspace SVG');
  await action('forge-template', '[data-template="pipeline"]').click();
  await page.locator('#forge-diagram-mount svg').waitFor();

  for (const viewport of [{ width: 320, height: 700 }, { width: 393, height: 852 }, { width: 420, height: 912 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    for (const tab of ['diagram', 'ui']) {
      await action('forge-tab', `[data-tab="${tab}"]`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tab} overflow at ${viewport.width}px`);
      assert.ok(await page.locator('.forge-source').evaluate(input => parseFloat(getComputedStyle(input).fontSize) >= 16), 'Phone source editors must avoid focus zoom');
    }
  }
  await page.screenshot({ path: 'tests/forge-ui-phone.png', fullPage: true });

  const touch = await browser.newPage({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  touch.on('pageerror', error => faults.push(error.message));
  await touch.addInitScript(snapshot => localStorage.setItem('pip-studio-v1', JSON.stringify(snapshot)), await stored());
  await touch.goto(base);
  await touch.locator('[data-action="page"][data-page="forge"]:visible').first().tap();
  for (const viewport of [{ width: 420, height: 912 }, { width: 844, height: 390 }]) {
    await touch.setViewportSize(viewport);
    for (const tab of ['diagram', 'ui']) {
      await touch.locator(`[data-action="forge-tab"][data-tab="${tab}"]`).tap();
      assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Touch ${tab} overflow at ${viewport.width}×${viewport.height}`);
    }
  }
  await touch.setViewportSize({ width: 420, height: 912 });
  await touch.screenshot({ path: 'tests/forge-ui-touch-phone.png', fullPage: true });
  await touch.close();
  assert.equal(externalAssets.length, 0);
  assert.deepEqual(faults, []);
  assert.ok(calls.length >= 2 && calls.every(call => call.demo === true && !call.key), 'Playground generations must remain sample requests without a key');
  console.log('PASS: real Mermaid parse/render, strict SVG sanitization, source/SVG/real PNG exports, invalid-source recovery, safe interactive native UI, no silent calls, prepared backend generation, import cache isolation, and phone layouts.');
} finally { await browser.close(); }
