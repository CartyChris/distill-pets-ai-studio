import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ['--no-sandbox'],
});
const profiles = [
  { name: 'laptop', width: 1440, height: 1000 },
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'iphone-air', width: 420, height: 912 },
];
const faults = [];
let verifiedCanvases = 0;
let verifiedViews = 0;

try {
  for (const profile of profiles) {
    for (const scale of ['1', '1.2']) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        isMobile: profile.width < 760,
        hasTouch: profile.width < 760,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.on('pageerror', error => faults.push(`${profile.name}: ${error.message}`));
      await page.goto(process.env.APP_URL || 'http://localhost:5190');
      if (process.env.AVATAR_CSS) await page.addStyleTag({ content: await fs.readFile(process.env.AVATAR_CSS, 'utf8') });

      const view = async id => {
        if (await page.locator('#adventure-root').isVisible()) {
          await page.getByRole('button', { name: 'All views', exact: true }).filter({ visible: true }).click();
          await page.locator('#modal').locator(`[data-page="${id}"]`).click();
          return;
        }
        const mobile = await page.locator('.mobile-nav').isVisible();
        await page.locator(mobile ? '.mobile-nav' : '.sidebar nav').locator(`[data-page="${id}"]`).click();
      };
      const check = async label => {
        const result = await page.evaluate(() => {
          const visible = element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
          const canvases = [...document.querySelectorAll('canvas.pixel')].filter(visible);
          const distorted = canvases.map(canvas => {
            const style = getComputedStyle(canvas);
            const box = canvas.getBoundingClientRect();
            // The browser may contain a 3:4 image inside a square icon box.
            // Without containment, the actual image must retain its native ratio.
            const ratio = parseFloat(style.width) / parseFloat(style.height);
            const naturalRatio = canvas.width / canvas.height;
            const uniformFit = ['contain', 'scale-down'].includes(style.objectFit);
            return { owner: canvas.dataset.owner, pet: canvas.dataset.pet, width: box.width, height: box.height, fit: style.objectFit, distorted: !uniformFit && Math.abs(ratio - naturalRatio) > 0.015 };
          }).filter(canvas => canvas.distorted);
          const oversizedTeamIcons = [...document.querySelectorAll('.agent-row > .mascot')].filter(visible).map(mascot => {
            const style = getComputedStyle(mascot);
            return { width: parseFloat(style.width), height: parseFloat(style.height), grow: style.flexGrow };
          }).filter(icon => icon.width > 47 || icon.width < 45 || icon.height > 47 || icon.height < 45 || icon.grow !== '0');
          const distortedCartoons = [...document.querySelectorAll('.mascot > .avatar')].filter(visible).map(avatar => {
            const style = getComputedStyle(avatar);
            return { width: parseFloat(style.width), height: parseFloat(style.height) };
          }).filter(avatar => Math.abs(avatar.width - avatar.height) > 0.1);
          return { count: canvases.length, distorted, oversizedTeamIcons, distortedCartoons, overflow: document.documentElement.scrollWidth - innerWidth };
        });
        assert.deepEqual(result.oversizedTeamIcons, [], `${profile.name} @${scale} ${label}: team icons must keep a compact 46px slot`);
        assert.deepEqual(result.distorted, [], `${profile.name} @${scale} ${label}: pixel images must retain their native 36:48 proportions`);
        assert.deepEqual(result.distortedCartoons, [], `${profile.name} @${scale} ${label}: cartoon faces must stay square`);
        assert.ok(result.overflow <= 1, `${profile.name} @${scale} ${label}: horizontal overflow`);
        verifiedCanvases += result.count;
        verifiedViews++;
      };

      await check('initial workspace');
      await view('customize');
      await page.locator('#custom-scale').selectOption(scale);
      await page.locator('#custom-skin-milo').selectOption('pixel');
      await page.locator('#custom-species-milo').selectOption('fox');
      await page.locator('[data-action="custom-outfit"][data-owner="milo"][data-outfit="wizard"]').click();
      await page.locator('#custom-skin-nova').selectOption('pixel');
      await page.locator('#custom-species-nova').selectOption('bunny');
      await page.locator('[data-action="custom-outfit"][data-owner="nova"][data-outfit="scarf"]').click();
      await check('wardrobes and all outfit tiles');

      // Compare the rendered pixels with the real sprite's alpha bounds. This
      // catches stretched artwork even when the surrounding icon remains square.
      await view('workspace');
      const icon = page.locator(profile.width >= 760 ? '.agent-row [data-owner="milo"]' : '.agent-card [data-owner="milo"]').first();
      const native = await icon.evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 0) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        return { width: right - left + 1, height: bottom - top + 1 };
      });
      await icon.evaluate(canvas => canvas.style.background = '#01fe01');
      const png = await icon.screenshot();
      await icon.evaluate(canvas => canvas.style.removeProperty('background'));
      const drawn = await page.evaluate(async encoded => {
        const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const green = offset => Math.abs(pixels[offset] - 1) + Math.abs(pixels[offset + 1] - 254) + Math.abs(pixels[offset + 2] - 1) <= 10;
        // Fractional layout coordinates can add an ancestor-colored edge row
        // to the screenshot. Limit measurement to the canvas's green backdrop.
        let edgeLeft = canvas.width, edgeTop = canvas.height, edgeRight = -1, edgeBottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (green((y * canvas.width + x) * 4)) {
          edgeLeft = Math.min(edgeLeft, x); edgeRight = Math.max(edgeRight, x); edgeTop = Math.min(edgeTop, y); edgeBottom = Math.max(edgeBottom, y);
        }
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = edgeTop; y <= edgeBottom; y++) for (let x = edgeLeft; x <= edgeRight; x++) {
          const offset = (y * canvas.width + x) * 4;
          if (!green(offset)) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
        return { width: right - left + 1, height: bottom - top + 1 };
      }, png.toString('base64'));
      const relativeStretch = (drawn.width / native.width) / (drawn.height / native.height);
      assert.ok(Math.abs(relativeStretch - 1) < 0.13, `${profile.name} @${scale}: rendered sprite stretched by ${relativeStretch.toFixed(3)}×; native=${JSON.stringify(native)}, rendered=${JSON.stringify(drawn)}`);
      await check('equipped pixel agents in workspace');

      for (const id of ['academy', 'pets', 'research', 'live', 'adventure']) {
        await view(id);
        await check(id);
      }
      await view('customize');
      await page.getByRole('button', { name: 'Personalities & field kit', exact: true }).click();
      for (const companion of ['milo', 'nova']) {
        const details = page.locator(`[data-field-companion="${companion}"]`);
        if (!(await details.getAttribute('open')) && !(await details.evaluate(element => element.open))) await details.locator('summary').first().click();
        const wardrobe = details.locator('[data-field-wardrobe]');
        if (!(await wardrobe.evaluate(element => element.open))) await wardrobe.locator('summary').click();
      }
      await check('field personalities and outfit previews');
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pip-studio-v1')));
      assert.equal(saved.agents.milo.outfit, 'wizard');
      assert.equal(saved.agents.nova.outfit, 'scarf');
      await context.close();
    }
  }
  assert.deepEqual(faults, []);
  console.log(`PASS: ${verifiedViews} view/profile checks and ${verifiedCanvases} pixel canvases; desktop/320px/420px at 1× and 1.2× text, native bitmap scaling, compact team icons, cartoon proportions, wardrobe/field previews, and unchanged outfits.`);
} finally {
  await browser.close();
}
