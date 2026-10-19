let installPrompt = null;
let registration = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function status() {
  const banner = document.getElementById('pwa-status');
  const offline = !navigator.onLine || document.documentElement.dataset.offlineShell === 'true';
  banner.hidden = !offline;
  document.body.classList.toggle('pip-offline', offline);
  banner.textContent = 'Offline · Your saved work is available. AI and playground requests need a connection.';
}
function mount() {
  const settings = document.querySelector('.page.settings');
  if (!settings || document.getElementById('pwa-install-card')) return;
  const card = document.createElement('section');
  card.id = 'pwa-install-card';
  card.className = 'card';
  card.innerHTML = `<h2>Your pocket-sized studio</h2><p class="help">Install Distill Pets AI Studio for a full-screen workspace on your iPhone or Android. Your saved projects, chips, outfits, and themes reopen offline. Model requests still need internet.</p><div class="row"><button data-action="pwa-install" class="blue">${standalone() ? 'Distill Pets AI Studio is installed' : 'Install Distill Pets AI Studio / Add to Home Screen'}</button><span class="help">${standalone() ? 'Running as an app' : 'Works on phones and laptops'}</span></div>`;
  settings.prepend(card);
}
function instructions() {
  const modal = document.getElementById('modal');
  const steps = iphone()
    ? '<li>Open Distill Pets AI Studio in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Keep Open as Web App enabled if shown, then tap Add.</li>'
    : '<li>Open your browser’s menu or install icon.</li><li>Choose Install app or Add to Home screen.</li><li>Launch Distill Pets AI Studio from its new app icon.</li>';
  modal.innerHTML = `<button data-action="close" class="close" aria-label="Close dialog">×</button><h2 id="modal-title">Distill Pets AI Studio on your Home Screen</h2><ol class="pwa-instructions">${steps}</ol><p class="help">Your workspace stays on this device. Export a backup before moving between browsers or devices. API keys remain in memory and must be re-entered after reopening.</p><button data-action="close" class="primary">Got it</button>`;
  if (!modal.open) modal.showModal();
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.getElementById('pwa-install-card')?.remove();
  mount();
});
document.addEventListener('click', async event => {
  if (!event.target.closest('[data-action="pwa-install"]')) return;
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else instructions();
});
const banner = document.createElement('div');
banner.id = 'pwa-status';
banner.setAttribute('role', 'status');
banner.hidden = true;
document.body.prepend(banner);
window.addEventListener('online', () => { delete document.documentElement.dataset.offlineShell; status(); });
window.addEventListener('offline', status);
status();
mount();
new MutationObserver(mount).observe(document.getElementById('app'), { childList: true });
new MutationObserver(() => {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (color) document.querySelector('meta[name="theme-color"]').content = color;
}).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      registration.update();
    } catch {
      // Installation is optional; the regular online app remains available.
    }
  }, { once: true });
}
