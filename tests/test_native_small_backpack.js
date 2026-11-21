'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// First-idle regions from Unity's Human + Small Backpack + Bolt layers.
// The original target colors were confirmed with the underlay disabled.
const fixtures = require('./small-backpack-bolt-fixtures.json');
const loadHelper = version => new WebAssembly.Module(fs.readFileSync(
    path.join(__dirname, '../prototype', `native_underlay_${version}.wasm`),
));
const previous = loadHelper('v91');
const current = loadHelper('v93');
const pixels = 576 * 928;
const byteOffset = (x, y) => 4 * ((863 - y) * 576 + x);
const target = byteOffset(27, 17);

function run(module, layers) {
    const list = 0x30000, start = 0x40000, stride = 0x230000;
    const memory = new WebAssembly.Memory({ initial: 200 });
    const header = new DataView(memory.buffer);
    header.setUint32(list + 12, layers.length, true);
    const sources = layers.map(({x, y, width, height, rgba}, i) => {
        const source = start + i * stride;
        header.setUint32(list + 16 + 4 * i, source, true);
        header.setUint32(source + 12, pixels, true);
        const full = Buffer.from(memory.buffer, source + 16, pixels * 4);
        const region = Buffer.from(rgba, 'base64');
        for (let row = 0; row < height; row++) {
            region.copy(full, byteOffset(x, y + row), row * width * 4, (row + 1) * width * 4);
        }
        return full;
    });
    const originalGun = Buffer.from(sources.at(-1));
    const { phm_native_underlay } = new WebAssembly.Instance(module, {env: {memory}}).exports;
    const status = phm_native_underlay(list, start + stride * (layers.length - 1), 0);
    assert.deepEqual(sources.at(-1), originalGun, 'Firearm pixels stay intact');
    return { status, sources };
}

for (const [name, {target: color, layers}] of Object.entries(fixtures)) {
    const old = run(previous, layers);
    const next = run(current, layers);
    assert.equal(old.status, 5003, `${name}: reproduced the legacy Apache swatch match`);
    assert.equal(next.status, old.status);
    assert.deepEqual([...old.sources[0].subarray(target, target + 4)], [0, 0, 0, 0]);
    assert.deepEqual([...next.sources[0].subarray(target, target + 4)], color);
    old.sources[0].set(color, target);
    assert.deepEqual(next.sources, old.sources, `${name}: the backpack pixel is the only change`);
    console.log('PASS Small Backpack', name);
}

const [backpack, ...foreground] = fixtures.bolt.layers;
const altered = Buffer.from(backpack.rgba, 'base64');
// This point is masked out of the legacy swatch fingerprint, so changing it
// preserves the repro but makes the source differ from the real Small Backpack.
altered.set(fixtures.bolt.target, 4 * ((20 - backpack.y) * backpack.width + 30 - backpack.x));
const similar = [{...backpack, rgba: altered.toString('base64')}, ...foreground];
const oldSimilar = run(previous, similar);
assert.equal(oldSimilar.status, 5003);
assert.deepEqual(run(current, similar), oldSimilar, 'A different silhouette keeps the legacy behavior');
console.log('PASS similar silhouette is not protected');
