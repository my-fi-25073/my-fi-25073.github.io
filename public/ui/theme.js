(() => {
  const key = 'keylog-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let preference;
  try { preference = localStorage.getItem(key); } catch (error) {
    if (error.name !== 'SecurityError') throw error;
  }
  if (window !== window.top) root.dataset.themeEmbedded = '';
  function apply() {
    const automatic = system.matches ? 'dark' : 'light';
    root.dataset.theme = ['light', 'dark'].includes(preference) ? preference : automatic;
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && document.body) meta.content = getComputedStyle(root).backgroundColor;
  }
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue;
    apply();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    preference = next === (system.matches ? 'dark' : 'light') ? null : next;
    try {
      if (preference) localStorage.setItem(key, preference);
      else localStorage.removeItem(key);
    } catch (error) {
      if (!['SecurityError', 'QuotaExceededError'].includes(error.name)) throw error;
    }
    apply();
  });
})();
