/* The player loads only the packaged Unity binaries. PNG downloads stay local. */
(() => {
  'use strict';

  const assetURLs = new Set(['WebGL.data', 'WebGL.wasm', 'WebGL.framework.js'].map(
    file => new URL('Build/' + file, window.location.href).href
  ));

  function assetURL(input, method) {
    const url = new URL(input, window.location.href).href;
    if (!assetURLs.has(url) || !['GET', 'HEAD'].includes(String(method).toUpperCase())) {
      throw new TypeError('Only packaged game assets can be requested.');
    }
    return url;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const request = input instanceof Request ? input : null;
    const method = options.method ?? request?.method ?? 'GET';
    const url = assetURL(request?.url ?? input, method);
    if (options.body != null || request?.body != null) throw new TypeError('Uploads are disabled.');
    return nativeFetch(url, {
      method,
      signal: options.signal ?? request?.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error'
    });
  };

  // Compatibility path for the engine's asset loader.
  const xhr = window.XMLHttpRequest.prototype;
  const open = xhr.open, send = xhr.send;
  xhr.open = function (method, url, async = true) {
    return open.call(this, method, assetURL(url, method), async);
  };
  xhr.setRequestHeader = function () { throw new TypeError('Custom request headers are disabled.'); };
  xhr.send = function (body) {
    if (body != null) throw new TypeError('Uploads are disabled.');
    if (this.withCredentials) this.withCredentials = false;
    return send.call(this, null);
  };

  window.open = () => null;
  window.WebSocket = undefined;
  navigator.sendBeacon = () => false;
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (link && !(link.hasAttribute('download') && /^(blob:|data:)/i.test(link.href))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
