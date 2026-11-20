// Additional protection against opening external websites.
(() => {
  const isExternal = (url) => {
    try {
      const target = new URL(url, location.href);
      return (target.protocol === 'http:' || target.protocol === 'https:') && target.origin !== location.origin;
    } catch (_) { return false; }
  };
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (link && isExternal(link.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  const nativeOpen = window.open;
  window.open = function(url, ...args) {
    if (isExternal(url)) return null;
    return nativeOpen.call(this, url, ...args);
  };
})();
