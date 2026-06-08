(() => {
  const PAGE_ID = 'page-api-docs';
  const ADMIN_PASSWORD = '15091457326';
  let unlockedForCurrentEntry = false;
  let wasVisible = false;

  const text = {
    title: '\u7ba1\u7406\u5458\u9a8c\u8bc1',
    desc: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801\u540e\u8fdb\u5165\u3002',
    label: '\u7ba1\u7406\u5458\u5bc6\u94a5',
    placeholder: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u94a5',
    button: '\u8fdb\u5165\u63a5\u53e3\u8bf4\u660e',
    error: '\u5bc6\u94a5\u4e0d\u6b63\u786e\uff0c\u8bf7\u91cd\u65b0\u8f93\u5165\u3002'
  };

  const isVisible = (page) => {
    if (!page) return false;
    return page.style.display !== 'none' && getComputedStyle(page).display !== 'none';
  };

  const setError = (box, message) => {
    const error = box.querySelector('.zx-api-docs-lock-error');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
  };

  const unlock = (page) => {
    unlockedForCurrentEntry = true;
    page.classList.add('zx-api-docs-unlocked');
    page.classList.remove('zx-api-docs-locked');
  };

  const lock = (page) => {
    page.classList.add('zx-api-docs-locked');
    page.classList.remove('zx-api-docs-unlocked');
  };

  const ensureOverlay = (page) => {
    if (page.querySelector('.zx-api-docs-lock')) return;

    const overlay = document.createElement('div');
    overlay.className = 'zx-api-docs-lock';
    overlay.innerHTML = `
      <form class="zx-api-docs-lock-card" autocomplete="off">
        <div class="zx-api-docs-lock-copy">
          <h2>${text.title}</h2>
          <p>${text.desc}</p>
        </div>
        <label class="zx-api-docs-lock-field">
          <span>${text.label}</span>
          <input type="password" name="adminPassword" placeholder="${text.placeholder}" autocomplete="off" />
        </label>
        <div class="zx-api-docs-lock-error" hidden></div>
        <button type="submit" class="zx-api-docs-lock-submit">${text.button}</button>
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
      const overlay = page.querySelector('.zx-api-docs-lock');
      if (overlay) setError(overlay, '');
      const input = page.querySelector('.zx-api-docs-lock input');
      if (input) input.value = '';
    }
    wasVisible = visible;

    if (unlockedForCurrentEntry) {
      unlock(page);
    } else {
      lock(page);
      if (visible) {
        const input = page.querySelector('.zx-api-docs-lock input');
        if (input && document.activeElement !== input) setTimeout(() => input.focus(), 60);
      }
    }
  };

  setInterval(sync, 500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
