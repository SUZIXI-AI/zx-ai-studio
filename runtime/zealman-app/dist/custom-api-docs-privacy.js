(() => {
  const API_PAGE_ID = 'page-api-docs';
  const HIDDEN_ATTR = 'data-zx-hidden-api-docs-entry';

  const visibleText = (node) => String(node?.textContent || '').replace(/\s+/g, ' ').trim();

  const hideApiDocsNavEntry = () => {
    const candidates = document.querySelectorAll('a, button, [role="button"], .cursor-pointer, [class*="nav"]');
    candidates.forEach((el) => {
      if (el.getAttribute(HIDDEN_ATTR) === '1') return;
      const text = visibleText(el);
      if (!text || text !== '\u63a5\u53e3\u8bf4\u660e') return;
      const inAppSidebar = el.closest('aside') || el.closest('[class*="sidebar"]') || el.closest('[class*="Sidebar"]');
      if (!inAppSidebar) return;
      const target = el.closest('a, button, [role="button"], .group, .sidebar-nav-item') || el;
      target.style.setProperty('display', 'none', 'important');
      target.setAttribute(HIDDEN_ATTR, '1');
    });
  };

  const hideApiDocsDownloadButton = () => {
    const page = document.getElementById(API_PAGE_ID);
    if (!page) return;
    page.querySelectorAll('button, a').forEach((el) => {
      const text = visibleText(el);
      if (text.includes('\u4e0b\u8f7d\u6574\u9875 HTML')) {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute(HIDDEN_ATTR, '1');
      }
    });
  };

  const sync = () => {
    hideApiDocsNavEntry();
    hideApiDocsDownloadButton();
  };

  const observer = new MutationObserver(sync);
  const start = () => {
    sync();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(sync, 1000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
