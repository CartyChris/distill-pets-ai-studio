import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url = process.env.APP_URL || 'http://localhost:5180';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  if (window.top !== window || localStorage.getItem('pip-studio-v1')) return;
  localStorage.setItem('pip-studio-v1', JSON.stringify({ version:1,mode:'demo',agents:{milo:{model:'test/model'},nova:{model:'test/model'}},tasks:[{id:'saved-task',prompt:'My saved idea',text:'OFFLINE_SAVED_RESULT',agent:'milo',model:'playground/sample',demo:true,status:'complete'}],lessons:[] }));
});
try {
  await page.goto(url);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 });
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.ok(manifest.icons.some(i=>i.sizes==='512x512' && i.purpose.includes('maskable')));
  assert.ok(await page.locator('meta[name="viewport"]').getAttribute('content').then(x=>x.includes('viewport-fit=cover')));
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const icon = await page.evaluate(async path => {
    const response = await fetch(path);
    const image = new Image();
    image.src = path;
    await image.decode();
    return { status: response.status, width: image.naturalWidth, height: image.naturalHeight };
  }, touchIcon);
  assert.deepEqual(icon, { status: 200, width: 180, height: 180 });
  await page.getByRole('button',{name:'All views',exact:true}).click();
  await page.locator('#modal').getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Install Distill Pets AI Studio / Add to Home Screen',exact:true}).click();
  await page.getByText('Open Distill Pets AI Studio in Safari.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Got it',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByText('Offline · Your saved work is available. AI and playground requests need a connection.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Saved tasks',exact:true}).click();
  await page.locator('#modal').getByRole('button',{name:'My saved idea',exact:true}).click();
  await page.getByText('OFFLINE_SAVED_RESULT',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const cached = await page.evaluate(async()=>{
    const urls=[];
    for(const name of await caches.keys())if(name.startsWith('pip-shell-'))for(const req of await (await caches.open(name)).keys())urls.push(req.url);
    return urls;
  });
  assert.ok(cached.some(x=>x.includes('/assets/')));
  assert.ok(!cached.some(x=>x.includes('/api/')||x.includes('openrouter')||x.includes('private-platform-api')));
  assert.deepEqual(errors,[]);
  await context.setOffline(false);
  console.log('PASS: iPhone Air PWA manifest/icons/install guidance, safe viewport, active service worker, offline reload and saved-task access, API exclusion from shell cache.');
} finally { await browser.close(); }
