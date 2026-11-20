'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const game = path.join(__dirname, '../game');
const source = name => fs.readFileSync(path.join(game, name), 'utf8');

async function main() {
    const index = source('index.html');
    const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
    assert.deepEqual(scripts, ['offline-ui.js', 'phm-static-idle.js', 'phm-sprite-atlas.js']);
    assert(index.includes('<title>Pixel Hero Maker [v.90]</title>'));
    assert(index.includes("form-action 'none'"));
    assert(index.includes("connect-src 'self'"));
    assert(index.includes('name="referrer" content="no-referrer"'));
    assert(!/https?:\/\/|phm-diag/.test(index));
    const native = new WebAssembly.Module(fs.readFileSync(path.join(game, 'Build/WebGL.wasm')));
    assert.deepEqual(WebAssembly.Module.exports(native).filter(e => e.name.startsWith('phm_')), [
        { name: 'phm_hand_scratch', kind: 'global' },
    ]);

    const listeners = new Map(), downloads = [], requests = [];
    const context2D = { clearRect() {}, putImageData() {}, drawImage() {} };
    class WebGL {
        constructor() {
            this.TEXTURE0 = 33984;
            this.TEXTURE_2D = 3553;
            this.RGBA = 6408;
            this.UNSIGNED_BYTE = 5121;
        }
        activeTexture() {}
        bindTexture() {}
        useProgram() {}
        getProgramParameter() { return 2; }
        getActiveUniform(_program, index) { return { name: ['_Flip', '_RendererColor'][index] }; }
        texImage2D(...args) { this.lastUpload = args; return 'uploaded'; }
        texSubImage2D(...args) { this.lastUpload = args; return 'uploaded'; }
        drawArrays() {}
    }
    class XHR {
        constructor() { this.withCredentials = false; }
        open(method, url) { requests.push({ method, url }); }
        send() {}
    }
    class Anchor {
        click() { downloads.push({ name: this.download, url: this.href }); }
        getAttribute(name) { return this[name]; }
        hasAttribute(name) { return name in this; }
    }
    class MockImageData {}
    const navigator = { sendBeacon() { throw new Error('Unexpected native beacon'); } };
    const location = { href: 'https://example.test/MUTTS-Pixel-Generator/' };
    const document = {
        readyState: 'loading',
        addEventListener(name, listener) { listeners.set(name, listener); },
        getElementById(id) {
            if (id === 'phm-native-preview-surface') return { getContext: () => context2D };
            return null;
        },
        createElement() {
            return { getContext: () => context2D, toDataURL: () => 'data:image/png;base64,dGVzdA==' };
        },
    };
    const window = {
        navigator, location, WebGL2RenderingContext: WebGL, XMLHttpRequest: XHR,
        fetch: async (url, options) => {
            requests.push({ method: options.method, url });
            assert.equal(options.credentials, 'omit');
            assert.equal(options.redirect, 'error');
            assert.equal(options.referrerPolicy, 'no-referrer');
            assert.equal(options.headers, undefined);
        },
    };
    let refresh;
    const sandbox = vm.createContext({
        window, document, navigator, URL, Request, HTMLAnchorElement: Anchor,
        ImageData: MockImageData, setInterval(fn) { refresh = fn; },
    });
    for (const name of scripts) vm.runInContext(source(name), sandbox, { filename: name });
    listeners.get('DOMContentLoaded')();

    await window.fetch('Build/WebGL.data', { headers: { 'X-Test': 'private' } });
    const xhr = new XHR();
    xhr.open('HEAD', 'Build/WebGL.wasm');
    xhr.withCredentials = true;
    xhr.send();
    assert.equal(xhr.withCredentials, false);
    for (const target of ['https://other.test/', 'Build/WebGL.data?token=example', './index.html']) {
        await assert.rejects(window.fetch(target));
        assert.throws(() => xhr.open('GET', target));
    }
    await assert.rejects(window.fetch('Build/WebGL.data', { method: 'POST', body: 'test' }));
    assert.throws(() => xhr.send('test'));
    assert.throws(() => xhr.setRequestHeader('X-Test', 'private'));
    assert.equal(window.open('https://other.test/'), null);
    assert.equal(navigator.sendBeacon('https://other.test/', 'test'), false);
    assert.deepEqual(requests, [
        { method: 'GET', url: location.href + 'Build/WebGL.data' },
        { method: 'HEAD', url: location.href + 'Build/WebGL.wasm' },
    ]);
    let blocked = false;
    const external = Object.assign(new Anchor(), { href: 'https://other.test/' });
    listeners.get('click')({
        target: { closest: () => external },
        preventDefault() { blocked = true; },
        stopImmediatePropagation() {},
    });
    assert(blocked, 'external anchor click');

    const gl = new WebGL();
    const raw = new Uint8Array(576 * 928 * 4);
    const offset = ((927 - 64 - 19) * 576 + 27) * 4;
    raw.set([37, 91, 205, 255], offset);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, {});
    gl.useProgram({});
    assert.equal(gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 576, 928, 0, gl.RGBA, gl.UNSIGNED_BYTE, raw), 'uploaded');
    assert.equal(gl.lastUpload[8], raw);
    gl.drawArrays();
    refresh();
    assert(window.PHMIdleFrame.ready());
    const spriteIndex = (19 * 64 + 27) * 4;
    assert.deepEqual(Array.from(window.PHMSpriteAtlas.idleFrame().slice(spriteIndex, spriteIndex + 4)), [37, 91, 205, 255]);
    raw.set([50, 60, 70, 255], offset);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 576, 928, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    assert.equal(gl.lastUpload[8], raw);
    refresh();

    Object.assign(new Anchor(), { download: 'SpriteSheet.png', href: 'blob:unity-export' }).click();
    assert.deepEqual(downloads.at(-1), { name: 'SpriteSheet.png', url: 'data:image/png;base64,dGVzdA==' });
    Object.assign(new Anchor(), { download: 'MySprite.png', href: 'blob:custom-export' }).click();
    assert.deepEqual(downloads.at(-1), { name: 'MySprite.png', url: 'blob:custom-export' });
    console.log('PASS player browser mock, native module exports, local-only asset reads, and sprite PNG handling');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
