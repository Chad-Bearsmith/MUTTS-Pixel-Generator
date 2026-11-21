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
    const release = '?build=103';
    assert.deepEqual(scripts, ['offline-ui.js', 'mutts-static-idle.js', 'mutts-sprite-atlas.js', 'mutts-randomize.js'].map(name => name + release));
    assert(index.includes('<title>MUTTS Pixel Generator [v.103]</title>'));
    for (const asset of ['loader.js', 'framework.js', 'wasm', 'data']) assert(index.includes('/WebGL.' + asset + release));
    assert(index.includes('window.MUTTSRandomize?.build === 103'));
    assert(!index.includes('<button'));
    assert.deepEqual([...index.matchAll(/<canvas id="([^"]+)"/g)].map(match => match[1]), ['unity-canvas']);
    assert(index.includes("form-action 'none'"));
    assert(index.includes("connect-src 'self'"));
    assert(index.includes('name="referrer" content="no-referrer"'));
    assert(!/https?:\/\/|phm-diag/.test(index));
    const native = new WebAssembly.Module(fs.readFileSync(path.join(game, 'Build/WebGL.wasm')));
    assert.deepEqual(WebAssembly.Module.exports(native).filter(e => e.name.startsWith('phm_')), [
        { name: 'phm_hand_scratch', kind: 'global' },
    ]);

    const listeners = new Map(), windowEvents = new Map(), downloads = [], requests = [];
    const context2D = { clearRect() {}, putImageData() {}, drawImage() {} };
    const unityVAO = {};
    class WebGL {
        constructor(id = 'unity-canvas') {
            this.canvas = { id, addEventListener: (name, listener) => { this.onRestored = listener; } };
            this.TEXTURE0 = 33984;
            this.TEXTURE_2D = 3553;
            this.FRAMEBUFFER = 36160;
            this.DRAW_FRAMEBUFFER = 36009;
            this.RGBA = 6408;
            this.UNSIGNED_BYTE = 5121;
            this.LINK_STATUS = 35714;
            this.TRIANGLE_STRIP = 5;
            this.drawingBufferWidth = 960;
            this.drawingBufferHeight = 600;
            this.draws = 0;
            this.previews = 0;
            this.vao = unityVAO;
            this.depth = true;
        }
        activeTexture() {}
        bindTexture() {}
        bindFramebuffer() {}
        useProgram(program) { this.currentProgram = program; }
        getProgramParameter(program, key) { return key === this.LINK_STATUS ? !this.failLink : program.uniforms.length; }
        getActiveUniform(program, index) { return { name: program.uniforms[index] }; }
        createProgram() { return { preview: true }; }
        createShader() { return {}; }
        shaderSource(_shader, source) { if (source.includes('gl_Position')) this.vertexSource = source; }
        compileShader() {}
        attachShader() {}
        deleteShader() {}
        linkProgram() {}
        deleteProgram() {}
        createVertexArray() { return {}; }
        getUniformLocation(_program, name) { return name; }
        uniform1f(name, value) { this[name] = value; }
        bindVertexArray(vao) { this.vao = vao; }
        getParameter() { return this.vao; }
        isEnabled() { return this.depth; }
        enable() { this.depth = true; }
        disable() { this.depth = false; }
        texImage2D(...args) { this.lastUpload = args; return 'uploaded'; }
        texSubImage2D(...args) { this.lastUpload = args; return 'uploaded'; }
        drawArrays(mode, start, count) {
            if (this.currentProgram?.preview) {
                assert.deepEqual([mode, start, count], [this.TRIANGLE_STRIP, 0, 4]);
                assert.notEqual(this.vao, unityVAO);
                assert.equal(this.depth, false);
                this.previews++;
            } else {
                this.draws++;
            }
        }
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
        getElementById() { return null; },
        createElement() {
            return { getContext: () => context2D, toDataURL: () => 'data:image/png;base64,dGVzdA==' };
        },
    };
    const window = {
        navigator, location, WebGL2RenderingContext: WebGL, XMLHttpRequest: XHR,
        addEventListener(name, listener) { windowEvents.set(name, listener); },
        fetch: async (url, options) => {
            requests.push({ method: options.method, url });
            assert.equal(options.credentials, 'omit');
            assert.equal(options.redirect, 'error');
            assert.equal(options.referrerPolicy, 'no-referrer');
            assert.equal(options.headers, undefined);
        },
    };
    const sandbox = vm.createContext({
        window, document, navigator, URL, Request, HTMLAnchorElement: Anchor,
        ImageData: MockImageData,
    });
    for (const name of scripts) {
        document.currentScript = { src: new URL(name, location.href).href };
        vm.runInContext(source(name.split('?')[0]), sandbox, { filename: name });
    }
    assert.equal(window.MUTTSRandomize.build, 103);
    listeners.get('DOMContentLoaded')();
    let tabHandled = false;
    windowEvents.get('keydown')({ key: 'Tab', stopImmediatePropagation() { tabHandled = true; } });
    assert(tabHandled, 'Unity cannot capture browser Tab navigation');

    await window.fetch('Build/WebGL.data' + release, { headers: { 'X-Test': 'private' } });
    const xhr = new XHR();
    xhr.open('HEAD', 'Build/WebGL.wasm' + release);
    xhr.withCredentials = true;
    xhr.send();
    assert.equal(xhr.withCredentials, false);
    for (const target of ['https://other.test/', 'Build/WebGL.data?token=example', 'Build/WebGL.data?build=102', 'Build/WebGL.data', './index.html']) {
        await assert.rejects(window.fetch(target));
        assert.throws(() => xhr.open('GET', target));
    }
    await assert.rejects(window.fetch('Build/WebGL.data' + release, { method: 'POST', body: 'test' }));
    assert.throws(() => xhr.send('test'));
    assert.throws(() => xhr.setRequestHeader('X-Test', 'private'));
    assert.equal(window.open('https://other.test/'), null);
    assert.equal(navigator.sendBeacon('https://other.test/', 'test'), false);
    assert.deepEqual(requests, [
        { method: 'GET', url: location.href + 'Build/WebGL.data' + release },
        { method: 'HEAD', url: location.href + 'Build/WebGL.wasm' + release },
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
    const sprite = { uniforms: ['_Flip', '_RendererColor'] };
    const atlas = {};
    const raw = new Uint8Array(576 * 928 * 4);
    const offset = ((927 - 64 - 19) * 576 + 27) * 4;
    raw.set([37, 91, 205, 255], offset);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.useProgram(sprite);
    gl.drawArrays();
    assert.equal(gl.draws, 1, 'native startup draw without a captured atlas');
    assert.equal(gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 576, 928, 0, gl.RGBA, gl.UNSIGNED_BYTE, raw), 'uploaded');
    assert.equal(gl.lastUpload[8], raw);
    gl.drawArrays();
    assert.equal(gl.draws, 1, 'idle quad replaces the scene body draw');
    assert.equal(gl.previews, 1);
    assert.equal(gl.viewportAspect, 960 / 600);
    assert(gl.vertexSource.includes('vec2(112.0, 204.0) + uv * 256.0'));
    assert.equal(gl.currentProgram, sprite);
    assert.equal(gl.vao, unityVAO);
    assert.equal(gl.depth, true);
    gl.bindTexture(gl.TEXTURE_2D, {});
    gl.drawArrays();
    assert.equal(gl.draws, 1, 'separate firearm draw is suppressed');
    assert.equal(gl.previews, 1, 'the firearm does not issue a duplicate quad');
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, {});
    gl.drawArrays();
    assert.equal(gl.draws, 2, 'offscreen sprite draws are preserved');
    gl.bindFramebuffer(gl.FRAMEBUFFER, undefined);
    gl.drawArrays();
    assert.equal(gl.draws, 2, 'Unity may omit the binding when restoring the screen framebuffer');
    gl.useProgram({ uniforms: ['_Flip', '_RendererColor', '_ClipRect'] });
    gl.drawArrays();
    assert.equal(gl.draws, 3, 'Unity UI draws are preserved');
    const other = new WebGL('other-canvas');
    other.useProgram(sprite);
    other.drawArrays();
    assert.equal(other.draws, 1, 'other canvases keep their sprite draws');
    const spriteIndex = (19 * 64 + 27) * 4;
    assert.deepEqual(Array.from(window.MUTTSSpriteAtlas.idleFrame().slice(spriteIndex, spriteIndex + 4)), [37, 91, 205, 255]);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    raw.set([50, 60, 70, 255], offset);
    raw.set([88, 99, 110, 255], ((927 - 64 - 23) * 576 + 30) * 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 576, 928, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    assert.equal(gl.lastUpload[8], raw);
    gl.drawingBufferWidth = 720;
    gl.useProgram(sprite);
    gl.drawArrays();
    assert.equal(gl.viewportAspect, 720 / 600);
    assert(gl.vertexSource.includes('vec2(112.0, 204.0) + uv * 256.0'));
    assert.deepEqual(Array.from(window.MUTTSSpriteAtlas.idleFrame().slice(spriteIndex, spriteIndex + 4)), [50, 60, 70, 255]);

    const fallback = new WebGL();
    fallback.failLink = true;
    fallback.bindTexture(fallback.TEXTURE_2D, {});
    fallback.useProgram(sprite);
    fallback.texImage2D(fallback.TEXTURE_2D, 0, fallback.RGBA, 576, 928, 0, fallback.RGBA, fallback.UNSIGNED_BYTE, raw);
    fallback.drawArrays();
    assert.equal(fallback.draws, 1, 'the scene still draws if the shader fails');
    assert.equal(fallback.previews, 0);

    Object.assign(new Anchor(), { download: 'SpriteSheet.png', href: 'blob:unity-export' }).click();
    assert.deepEqual(downloads.at(-1), { name: 'SpriteSheet.png', url: 'data:image/png;base64,dGVzdA==' });
    Object.assign(new Anchor(), { download: 'MySprite.png', href: 'blob:custom-export' }).click();
    assert.deepEqual(downloads.at(-1), { name: 'MySprite.png', url: 'blob:custom-export' });
    gl.onRestored();
    assert.equal(window.MUTTSSpriteAtlas.idleFrame(), undefined, 'context restoration invalidates the old atlas');
    console.log('PASS player browser mock, native exports, local-only asset reads, in-canvas preview, and PNG handling');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
