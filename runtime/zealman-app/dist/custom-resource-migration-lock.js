(() => {
  const PAGE_ID = 'page-resource-migration';
  const ADMIN_PASSWORD = '15091457326';
  let unlockedForCurrentEntry = false;
  let wasVisible = false;

  const text = {
    title: '\u7ba1\u7406\u5458\u9a8c\u8bc1',
    desc: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801\u540e\u8fdb\u5165\u3002',
    label: '\u7ba1\u7406\u5458\u5bc6\u94a5',
    placeholder: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u94a5',
    button: '\u8fdb\u5165\u8d44\u6e90\u8fc1\u79fb',
    error: '\u5bc6\u94a5\u4e0d\u6b63\u786e\uff0c\u8bf7\u91cd\u65b0\u8f93\u5165\u3002'
  };

  const isVisible = (page) => {
    if (!page) return false;
    return page.style.display !== 'none' && getComputedStyle(page).display !== 'none';
  };


  const isMigrationRequest = (input) => {
    const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
    if (!rawUrl) return false;
    try {
      const url = new URL(rawUrl, window.location.origin);
      return url.pathname.startsWith('/api/migrate');
    } catch {
      return String(rawUrl).includes('/api/migrate');
    }
  };

  if (window.fetch && !window.__zxResourceMigrationFetchGuard) {
    const nativeFetch = window.fetch.bind(window);
    window.__zxResourceMigrationFetchGuard = true;
    window.fetch = (input, init = {}) => {
      if (!isMigrationRequest(input)) return nativeFetch(input, init);
      const headers = new Headers(
        init.headers || (typeof input !== 'string' && input && input.headers) || undefined
      );
      if (unlockedForCurrentEntry) {
        headers.set('X-ZX-Resource-Migration-Key', ADMIN_PASSWORD);
      } else {
        headers.delete('X-ZX-Resource-Migration-Key');
      }
      return nativeFetch(input, { ...init, headers });
    };
  }

  const setError = (box, message) => {
    const error = box.querySelector('.zx-resource-lock-error');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
  };

  const unlock = (page) => {
    unlockedForCurrentEntry = true;
    page.classList.add('zx-resource-unlocked');
    page.classList.remove('zx-resource-locked');
  };

  const lock = (page) => {
    page.classList.add('zx-resource-locked');
    page.classList.remove('zx-resource-unlocked');
  };

  const ensureOverlay = (page) => {
    if (page.querySelector('.zx-resource-lock')) return;

    const overlay = document.createElement('div');
    overlay.className = 'zx-resource-lock';
    overlay.innerHTML = `
      <form class="zx-resource-lock-card" autocomplete="off">
        <div class="zx-resource-lock-icon" aria-hidden="true">*</div>
        <div class="zx-resource-lock-copy">
          <h2>${text.title}</h2>
          <p>${text.desc}</p>
        </div>
        <label class="zx-resource-lock-field">
          <span>${text.label}</span>
          <input type="password" name="adminPassword" placeholder="${text.placeholder}" autocomplete="off" />
        </label>
        <div class="zx-resource-lock-error" hidden></div>
        <button type="submit" class="zx-resource-lock-submit">${text.button}</button>
      </form>
    `;

    overlay.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = overlay.querySelector('input[name="adminPassword"]');
      const value = String(input?.value || '').trim();
      if (value === ADMIN_PASSWORD) {
        setError(overlay, '');
        if (input) input.value = '';
        unlock(page);
      } else {
        setError(overlay, text.error);
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    });

    page.appendChild(overlay);
  };

  const sync = () => {
    const page = document.getElementById(PAGE_ID);
    if (!page) return;
    ensureOverlay(page);

    const visible = isVisible(page);
    if (visible && !wasVisible) {
      unlockedForCurrentEntry = false;
      const overlay = page.querySelector('.zx-resource-lock');
      if (overlay) setError(overlay, '');
      const input = page.querySelector('.zx-resource-lock input');
      if (input) input.value = '';
    }
    wasVisible = visible;

    if (unlockedForCurrentEntry) {
      unlock(page);
    } else {
      lock(page);
      if (visible) {
        const input = page.querySelector('.zx-resource-lock input');
        if (input && document.activeElement !== input) setTimeout(() => input.focus(), 60);
      }
    }
  };

  setInterval(sync, 500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
