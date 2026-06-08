(() => {
  const TITLE_TO_LIGHT = '\u5207\u6362\u5230\u4eae\u8272\u6a21\u5f0f';
  const TITLE_TO_DARK = '\u5207\u6362\u5230\u6697\u8272\u6a21\u5f0f';
  const MARKUP = `
    <span class="zx-theme-switch-track" aria-hidden="true">
      <span class="zx-theme-cloud zx-theme-cloud-dark zx-theme-cloud-1"></span>
      <span class="zx-theme-cloud zx-theme-cloud-dark zx-theme-cloud-2"></span>
      <span class="zx-theme-cloud zx-theme-cloud-dark zx-theme-cloud-3"></span>
      <span class="zx-theme-cloud zx-theme-cloud-4"></span>
      <span class="zx-theme-cloud zx-theme-cloud-5"></span>
      <span class="zx-theme-cloud zx-theme-cloud-6"></span>
      <span class="zx-theme-stars">
        <span class="zx-theme-star zx-theme-star-1"></span>
        <span class="zx-theme-star zx-theme-star-2"></span>
        <span class="zx-theme-star zx-theme-star-3"></span>
        <span class="zx-theme-star zx-theme-star-4"></span>
      </span>
      <span class="zx-theme-switch-orb">
        <span class="zx-theme-ray zx-theme-ray-1"></span>
        <span class="zx-theme-ray zx-theme-ray-2"></span>
        <span class="zx-theme-ray zx-theme-ray-3"></span>
        <span class="zx-theme-moon-dot zx-theme-moon-dot-1"></span>
        <span class="zx-theme-moon-dot zx-theme-moon-dot-2"></span>
        <span class="zx-theme-moon-dot zx-theme-moon-dot-3"></span>
      </span>
    </span>`;

  const isThemeButton = (button) => {
    const title = button.getAttribute('title') || '';
    return title === TITLE_TO_LIGHT || title === TITLE_TO_DARK;
  };

  const isDark = (button) => {
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme === 'dark';
    try {
      const storedTheme = localStorage.getItem('zealman-theme');
      if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme === 'dark';
    } catch (_) {}
    return (button.getAttribute('title') || '') === TITLE_TO_LIGHT;
  };

  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceThemeButtons();
    });
  };

  function enhanceThemeButtons() {
    const buttons = Array.from(document.querySelectorAll('button[title]')).filter(isThemeButton);
    buttons.forEach((button) => {
      const title = button.getAttribute('title') || TITLE_TO_DARK;
      button.classList.add('zx-theme-switch');
      button.classList.toggle('zx-theme-dark', isDark(button));
      button.setAttribute('aria-label', title);
      if (button.dataset.zxThemeSwitch !== '1' || !button.querySelector('.zx-theme-switch-track')) {
        button.dataset.zxThemeSwitch = '1';
        button.innerHTML = MARKUP;
      }
    });
  }

  const start = () => {
    enhanceThemeButtons();
    const root = document.getElementById('root') || document.body || document.documentElement;
    new MutationObserver(scheduleEnhance).observe(root, { childList: true, subtree: true });
    new MutationObserver(scheduleEnhance).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', scheduleEnhance);
    setInterval(scheduleEnhance, 1200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
