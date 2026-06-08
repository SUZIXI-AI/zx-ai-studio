(() => {
  const STORAGE_KEY = 'zx_canvas_api_lines';
  const LINES = {
    main: {
      label: '\u4e3b\u7ebf\u8def',
      provider: 'comfly',
      keyField: 'comfly',
      keyPlaceholder: 'sk-xxxxx',
      desc: '\u7528\u4e8e\u753b\u5e03\u5728\u7ebf\u751f\u6210\u548c\u4e3b\u7ebf LLM \u5bf9\u8bdd\u3002',
      modelTargets: [
        { id: 'image', label: '\u56fe\u50cf\u751f\u6210\u6a21\u578b', storageKey: 'canvas_image_models_ordered', configKey: 'image_models', defaults: [] },
        { id: 'chat', label: 'LLM \u5bf9\u8bdd\u6a21\u578b', storageKey: 'canvas_chat_models_ordered', configKey: 'chat_models', defaults: [] }
      ]
    },
    backup: {
      label: '\u5907\u7528\u7ebf\u8def',
      provider: 'autodl',
      keyField: 'autodl',
      keyPlaceholder: 'sk-xxxxx',
      desc: '\u7528\u4e8e\u5907\u7528 LLM \u5bf9\u8bdd\u3002',
      modelTargets: [{ id: 'backup-chat', label: 'LLM \u6a21\u578b', storageKey: 'canvas_autodl_chat_models_ordered', configKey: 'autodl_chat_models', defaults: [] }]
    },
    extend: {
      label: '\u6269\u5c55\u7ebf\u8def',
      provider: 'modelscope',
      keyField: 'modelscope',
      keyPlaceholder: 'sk-xxxxx',
      desc: '\u7528\u4e8e\u6269\u5c55 LLM \u6216\u7b2c\u4e09\u65b9\u517c\u5bb9 API\u3002',
      modelTargets: [{ id: 'extend-chat', label: 'LLM \u6a21\u578b', storageKey: 'canvas_modelscope_chat_models_ordered', configKey: 'ms_chat_models', defaults: [] }]
    }
  };
  let configCache = null;
  let loadingConfig = false;

  const unique = list => {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map(v => String(v || '').trim()).filter(v => {
      if (!v || seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  };
  const loadConfig = async () => {
    if (configCache || loadingConfig) return configCache;
    loadingConfig = true;
    try {
      const res = await fetch('/wuli-api/api/config');
      configCache = res.ok ? await res.json() : {};
    } catch (_) { configCache = {}; }
    finally { loadingConfig = false; }
    return configCache;
  };
  const readLines = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
  };
  const saveLines = data => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
    notifyCanvas();
  };
  const notifyCanvas = () => {
    const frame = document.querySelector('iframe[src^="/wuli-api/static/canvas.html"]');
    try { frame?.contentWindow?.postMessage({ type: 'zx-api-models-updated' }, window.location.origin); } catch (_) {}
  };
  const getModels = target => {
    try {
      const raw = localStorage.getItem(target.storageKey);
      return raw === null ? [] : unique(JSON.parse(raw || '[]'));
    } catch (_) {
      return [];
    }
  };
  const setModels = (target, models) => {
    localStorage.setItem(target.storageKey, JSON.stringify(unique(models)));
    notifyCanvas();
  };
  const findForm = () => Array.from(document.querySelectorAll('form')).find(form => (
    form.querySelector('input[placeholder="autodl-xxxxx"]') &&
    form.querySelector('input[placeholder="sk-xxxxx"]') &&
    form.querySelector('input[placeholder="ms-xxxxx"]')
  ));
  const activeLine = panel => panel.dataset.line || 'main';
  const activeTarget = panel => {
    const line = LINES[activeLine(panel)] || LINES.main;
    const select = panel.querySelector('[data-zx-model-kind]');
    return line.modelTargets.find(t => t.id === select?.value) || line.modelTargets[0];
  };
  const getReactKeyInput = (form, lineKey) => {
    const line = LINES[lineKey] || LINES.main;
    return form.querySelector(`input[placeholder="${line.keyField === 'autodl' ? 'autodl-xxxxx' : line.keyField === 'modelscope' ? 'ms-xxxxx' : 'sk-xxxxx'}"]`);
  };
  const hideOriginalFields = form => {
    ['autodl-xxxxx', 'sk-xxxxx', 'ms-xxxxx'].forEach(ph => {
      const label = form.querySelector(`input[placeholder="${ph}"]`)?.closest('label');
      if (label) label.style.display = 'none';
    });
    form.querySelectorAll('button[title*="ZXAI777888"]').forEach(btn => {
      const box = btn.closest('.mt-3');
      if (box) box.style.display = 'none';
    });
  };
  const setNativeValue = (input, value) => {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter ? setter.call(input, value) : input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const renderModels = panel => {
    const target = activeTarget(panel);
    const list = getModels(target);
    const listEl = panel.querySelector('[data-zx-model-list]');
    const emptyEl = panel.querySelector('[data-zx-model-empty]');
    listEl.innerHTML = '';
    emptyEl.hidden = list.length > 0;
    list.forEach(model => {
      const chip = document.createElement('span');
      chip.className = 'zx-api-model-chip';
      chip.title = model;
      const text = document.createElement('span');
      text.textContent = model;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'x';
      del.addEventListener('click', () => {
        setModels(target, list.filter(item => item !== model));
        renderModels(panel);
      });
      chip.append(text, del);
      listEl.appendChild(chip);
    });
  };
  const updatePanel = form => {
    const panel = form.querySelector('[data-zx-api-panel]');
    if (!panel) return;
    const lineKey = activeLine(panel);
    const line = LINES[lineKey] || LINES.main;
    const lines = readLines();
    const cfg = lines[lineKey] || {};
    panel.querySelectorAll('[data-line]').forEach(btn => btn.classList.toggle('active', btn.dataset.line === lineKey));
    panel.querySelector('[data-zx-line-title]').textContent = line.label;
    panel.querySelector('[data-zx-line-desc]').textContent = line.desc;
    panel.querySelector('[data-zx-url-input]').value = cfg.baseUrl || '';
    panel.querySelector('[data-zx-key-input]').value = cfg.apiKey || '';
    panel.querySelector('[data-zx-key-label]').textContent = `${line.label} API Key`;
    panel.querySelector('[data-zx-key-input]').placeholder = line.keyPlaceholder;
    const kind = panel.querySelector('[data-zx-model-kind]');
    const previous = kind.value;
    kind.innerHTML = line.modelTargets.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
    kind.hidden = line.modelTargets.length <= 1;
    kind.value = line.modelTargets.some(t => t.id === previous) ? previous : line.modelTargets[0].id;
    renderModels(panel);
  };
  const saveCurrentLine = form => {
    const panel = form.querySelector('[data-zx-api-panel]');
    const lineKey = activeLine(panel);
    const lines = readLines();
    const line = LINES[lineKey] || LINES.main;
    const baseUrl = panel.querySelector('[data-zx-url-input]').value.trim();
    const apiKey = panel.querySelector('[data-zx-key-input]').value.trim();
    lines[lineKey] = { ...(lines[lineKey] || {}), baseUrl, apiKey };
    saveLines(lines);
    setNativeValue(getReactKeyInput(form, lineKey), apiKey);
    const status = panel.querySelector('[data-zx-save-status]');
    status.textContent = '\u5df2\u4fdd\u5b58\uff0c\u753b\u5e03\u4f1a\u4f7f\u7528\u8fd9\u6761\u7ebf\u8def\u7684 URL \u548c Key\u3002';
    setTimeout(() => { status.textContent = ''; }, 2600);
  };
  const enhanceForm = async form => {
    if (!form || form.dataset.zxApiProviderEnhanced === '1') return;
    form.dataset.zxApiProviderEnhanced = '1';
    await loadConfig();
    const title = form.querySelector('h3');
    if (title) title.textContent = '\u753b\u5e03 API \u914d\u7f6e';
    const desc = title?.parentElement?.querySelector('p');
    if (desc) desc.textContent = '\u5ba2\u6237\u53ef\u81ea\u884c\u6dfb\u52a0 URL\u3001API Key \u548c\u6a21\u578b ID\uff0c\u6dfb\u52a0\u540e\u753b\u5e03\u4e2d\u53ef\u76f4\u63a5\u9009\u62e9\u4f7f\u7528\u3002\u5982\u9700\u63a8\u8350 API\uff0c\u8054\u7cfb\u6280\u672f\u54a8\u8be2\u5fae\u4fe1\uff1aZXAI777888\u3002';
    hideOriginalFields(form);
    const host = form.querySelector('input[placeholder="sk-xxxxx"]')?.closest('label')?.parentElement || form.querySelector('div.space-y-4');
    if (!host) return;
    const panel = document.createElement('div');
    panel.dataset.zxApiPanel = '1';
    panel.dataset.line = 'main';
    panel.className = 'zx-api-provider-panel';
    panel.innerHTML = `
      <div class="zx-api-tabs">${Object.entries(LINES).map(([key, line]) => `<button type="button" data-line="${key}">${line.label}</button>`).join('')}</div>
      <div class="zx-api-service-card">
        <div class="zx-api-service-head"><div><div class="zx-api-eyebrow">\u5f53\u524d\u7ebf\u8def</div><div class="zx-api-provider-name" data-zx-line-title></div></div><span class="zx-api-status-pill">\u5ba2\u6237\u81ea\u5b9a\u4e49</span></div>
        <label class="zx-api-field"><span>URL</span><input data-zx-url-input type="url" placeholder="https://api.example.com/v1" /></label>
        <label class="zx-api-field"><span data-zx-key-label>API Key</span><input data-zx-key-input type="password" placeholder="sk-xxxxx" autocomplete="off" /></label>
        <p data-zx-line-desc></p>
      </div>
      <div class="zx-api-model-card">
        <div class="zx-api-model-head"><div><div class="zx-api-eyebrow">\u53ef\u7528\u6a21\u578b</div><strong>\u6dfb\u52a0\u540e\u4f1a\u51fa\u73b0\u5728\u753b\u5e03\u4e0b\u62c9\u5217\u8868</strong></div><select data-zx-model-kind></select></div>
        <div class="zx-api-model-list" data-zx-model-list></div>
        <div class="zx-api-model-empty" data-zx-model-empty>\u6682\u65e0\u6a21\u578b\uff0c\u8bf7\u5148\u6dfb\u52a0\u4e00\u4e2a\u670d\u52a1\u652f\u6301\u7684\u6a21\u578b ID\u3002</div>
        <div class="zx-api-model-add"><input type="text" data-zx-model-input placeholder="\u8f93\u5165\u6a21\u578b ID\uff0c\u4f8b\u5982 gpt-5.4-mini" /><button type="button" data-zx-model-add>\u6dfb\u52a0</button></div>
        <p class="zx-api-model-tip">\u6a21\u578b ID \u9700\u4e0e\u4f60\u586b\u5199\u7684 API \u670d\u52a1\u652f\u6301\u7684\u540d\u79f0\u4e00\u81f4\uff0c\u5426\u5219\u8c03\u7528\u4f1a\u5931\u8d25\u3002\u63a8\u8350 API \u8bf7\u8054\u7cfb\u5fae\u4fe1\uff1aZXAI777888</p>
      </div>
      <p class="zx-api-save-status" data-zx-save-status></p>
    `;
    host.parentElement.insertBefore(panel, host);
    panel.querySelectorAll('[data-line]').forEach(btn => btn.addEventListener('click', () => { panel.dataset.line = btn.dataset.line; updatePanel(form); }));
    panel.querySelector('[data-zx-model-kind]').addEventListener('change', () => renderModels(panel));
    const addModel = () => {
      const input = panel.querySelector('[data-zx-model-input]');
      const value = input.value.trim();
      if (!value) return;
      const target = activeTarget(panel);
      setModels(target, [...getModels(target), value]);
      input.value = '';
      renderModels(panel);
      input.focus();
    };
    panel.querySelector('[data-zx-model-add]').addEventListener('click', addModel);
    panel.querySelector('[data-zx-model-input]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      saveCurrentLine(form);
    }, true);
    updatePanel(form);
  };
  const tick = () => enhanceForm(findForm());
  const observer = new MutationObserver(tick);
  const start = () => { tick(); observer.observe(document.body || document.documentElement, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
