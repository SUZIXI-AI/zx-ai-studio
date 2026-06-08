(() => {
  const PAGE_ID = 'page-system-settings';
  const WRAP_CLASS = 'zx-dir-select';
  let activeWrap = null;

  const cleanLabel = (text) => String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2192\u21b3\u2514\u251c\u2500]+/g, '')
    .trim();

  const isChildOption = (option) => {
    const raw = String(option.textContent || '');
    return raw.includes('\u2514') || raw.includes('\u21b3') || raw.includes('\u251c') || /^\s{2,}/.test(raw.replace(/\u00a0/g, ' '));
  };

  const getTargetSelects = () => {
    const page = document.getElementById(PAGE_ID);
    if (!page) return [];
    return Array.from(page.querySelectorAll('select.w-full, select[class*="w-full"]')).filter((select) => {
      const block = select.closest('div');
      const label = block && block.querySelector('label');
      const labelText = label ? label.textContent.trim() : '';
      if (labelText.includes('\u9ad8\u7ea7\u76ee\u5f55\u9009\u62e9')) return true;
      const values = Array.from(select.options).map((option) => option.value).join('|');
      return values.includes('diffusion_models') && values.includes('checkpoints');
    });
  };

  const setNativeValue = (select, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, value);
    else select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const getSelectedText = (select) => {
    const selected = select.options[select.selectedIndex];
    return cleanLabel(selected?.textContent || select.value || '\u9009\u62e9\u76ee\u5f55');
  };

  const closeMenu = (wrap) => {
    if (!wrap) return;
    wrap.classList.remove('is-open');
    const trigger = wrap.querySelector('.zx-dir-trigger');
    const menu = wrap.querySelector('.zx-dir-menu');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
    if (activeWrap === wrap) activeWrap = null;
  };

  const openMenu = (wrap) => {
    if (activeWrap && activeWrap !== wrap) closeMenu(activeWrap);
    activeWrap = wrap;
    wrap.classList.add('is-open');
    const trigger = wrap.querySelector('.zx-dir-trigger');
    const menu = wrap.querySelector('.zx-dir-menu');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    if (menu) {
      menu.hidden = false;
      const selected = menu.querySelector('.zx-dir-option.is-selected');
      if (selected) setTimeout(() => selected.scrollIntoView({ block: 'nearest' }), 0);
    }
  };

  const buildMenu = (select, wrap) => {
    const selectedText = getSelectedText(select);
    const options = Array.from(select.options).filter((option) => option.value);
    const triggerText = wrap.querySelector('.zx-dir-selected');
    const meta = wrap.querySelector('.zx-dir-count');
    const menu = wrap.querySelector('.zx-dir-menu');
    if (triggerText) triggerText.textContent = selectedText;
    if (meta) meta.textContent = `${options.length} \u9879`;
    if (!menu) return;

    menu.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'zx-dir-menu-head';
    head.innerHTML = '<span>\u76ee\u5f55\u9009\u62e9</span><span>' + options.length + ' \u4e2a\u4f4d\u7f6e</span>';
    menu.appendChild(head);

    let previousWasChild = false;
    options.forEach((option) => {
      const child = isChildOption(option);
      const label = cleanLabel(option.textContent || option.value);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `zx-dir-option ${child ? 'is-child' : 'is-root'} ${option.value === select.value ? 'is-selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
      item.dataset.value = option.value;
      if (!child && previousWasChild) item.classList.add('starts-group');
      item.innerHTML = `
        <span class="zx-dir-check" aria-hidden="true">&#10003;</span>
        <span class="zx-dir-name"></span>
        <span class="zx-dir-badge">${child ? '\u5b50\u76ee\u5f55' : '\u4e3b\u76ee\u5f55'}</span>
      `;
      item.querySelector('.zx-dir-name').textContent = label;
      item.addEventListener('click', () => {
        setNativeValue(select, option.value);
        buildMenu(select, wrap);
        closeMenu(wrap);
      });
      menu.appendChild(item);
      previousWasChild = child;
    });
  };

  const enhanceSelect = (select) => {
    if (!select || select.dataset.zxDirSelectEnhanced === '1') {
      const existing = select?.nextElementSibling;
      if (existing?.classList?.contains(WRAP_CLASS)) buildMenu(select, existing);
      return;
    }

    select.dataset.zxDirSelectEnhanced = '1';
    select.classList.add('zx-native-dir-select');

    const wrap = document.createElement('div');
    wrap.className = WRAP_CLASS;
    wrap.innerHTML = `
      <button type="button" class="zx-dir-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="zx-dir-trigger-main">
          <span class="zx-dir-dot" aria-hidden="true"></span>
          <span class="zx-dir-selected"></span>
        </span>
        <span class="zx-dir-count"></span>
        <span class="zx-dir-chevron" aria-hidden="true"></span>
      </button>
      <div class="zx-dir-menu" role="listbox" hidden></div>
    `;

    select.insertAdjacentElement('afterend', wrap);
    const trigger = wrap.querySelector('.zx-dir-trigger');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.contains('is-open') ? closeMenu(wrap) : openMenu(wrap);
    });

    select.addEventListener('change', () => buildMenu(select, wrap));
    buildMenu(select, wrap);
  };

  const enhanceAll = () => getTargetSelects().forEach(enhanceSelect);

  document.addEventListener('click', (event) => {
    if (activeWrap && !activeWrap.contains(event.target)) closeMenu(activeWrap);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeWrap) closeMenu(activeWrap);
  });

  const boot = () => {
    enhanceAll();
    const page = document.getElementById(PAGE_ID) || document.body;
    const observer = new MutationObserver(() => enhanceAll());
    observer.observe(page, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
