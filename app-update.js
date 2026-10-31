// Version checks never reload a form or change its contents automatically.
(() => {
  const currentVersion = '4.6.1';
  let checking = false, registration;
  const base = new URL('.', document.currentScript.src);
  const banner = document.createElement('aside');
  banner.className = 'card no-print';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  const label = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.textContent = 'Neue Version laden';
  banner.append(label, button);
  document.querySelector('.wrap').prepend(banner);
  button.onclick = () => {
    if (window.confirm('Neue Version laden? Bitte zuerst offene Eingaben speichern. Beim Neuladen werden ungespeicherte Formulareingaben verworfen.')) {
      window.location.reload();
    }
  };
  async function check() {
    if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      const response = await fetch(new URL('version.json', base), {cache: 'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      if (/^\d+\.\d+\.\d+$/.test(data.version) && data.version !== currentVersion) {
        label.textContent = `Version ${data.version} ist verfügbar. Bitte offene Eingaben speichern und anschließend die neue Version laden.`;
        banner.hidden = false;
      } else if (data.version === currentVersion) {
        banner.hidden = true;
      }
    } catch (_) {
      // Offline operation and cached data remain available.
    } finally {
      checking = false;
    }
    if (registration) void registration.update().catch(() => {});
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('sw.js', base).href, {updateViaCache: 'none'})
      .then(reg => {registration = reg; return reg.update();}).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', check);
  }
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 5 * 60 * 1000);
  void check();
})();
