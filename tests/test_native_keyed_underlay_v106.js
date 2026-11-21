'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {bolt} = require('./small-backpack-bolt-fixtures.json');

const memory = new WebAssembly.Memory({initial: 200});
const binary = fs.readFileSync(path.join(__dirname, '../prototype/native_keyed_underlay_v106.wasm'));
const {mutts_keyed_underlay: repair} = new WebAssembly.Instance(
    new WebAssembly.Module(binary), {env: {memory}},
).exports;
const arrayLength = 576 * 928;
const [key, human, list] = [0x1000, 0x1100, 0x2000];
const [item, accessory, gun, rendered, cached] = [0, 1, 2, 3, 4].map(i => 0x10000 + i * 0x220000);
const view = new DataView(memory.buffer);
const store = (address, value) => view.setUint32(address, value, true);
const index = (x, y) => (863 - y) * 576 + x;
function useKey(address, value) {
    store(address + 8, value.length);
    for (let i = 0; i < value.length; i++) view.setUint16(address + 12 + 2 * i, value.charCodeAt(i), true);
}
function array(address) {
    store(address + 12, arrayLength);
    return new Uint32Array(memory.buffer, address + 16, arrayLength);
}
function useLayers(...layers) {
    store(list + 12, layers.length);
    layers.forEach((layer, i) => store(list + 16 + 4 * i, layer));
}
const itemPixels = array(item);
const foreground = array(accessory);
const source = array(gun);
const drawn = array(rendered);
const original = array(cached);
const gunFixture = bolt.layers.at(-1);
const gunBytes = Buffer.from(gunFixture.rgba, 'base64');
for (let y = 0; y < gunFixture.height; y++) {
    for (let x = 0; x < gunFixture.width; x++) {
        source[index(gunFixture.x + x, gunFixture.y + y)] = gunBytes.readUInt32LE(4 * (y * gunFixture.width + x));
    }
}
drawn.set(source);
const marker = drawn.findIndex(pixel => (pixel >>> 24) === 254);
assert(marker >= 0, 'real Bolt fixture contains a hand marker');
drawn[marker] ^= 0x40;
useLayers(item, accessory, rendered);
useKey(human, 'Human#E9BB94');

const main = 0xffcc4422, shade = 0xff6655ff, highlight = 0xff2f7e5e;
const fixtures = [
    ['Cape', 1, [[[27, 19], main]], [[[27, 17], main]]],
    ['FireLizard', 2, [[[25, 20], main], [[29, 19], shade]],
        [[[27, 18], main], [[26, 19], main], [[27, 19], shade], [[26, 20], shade], [[27, 20], shade]]],
    ['Lizard', 8, [[[25, 20], main], [[29, 19], shade]],
        [[[27, 18], main], [[26, 19], main], [[27, 19], shade], [[26, 20], shade], [[27, 20], shade]]],
    ['Apache', 3, [[[27, 17], main]], [[[27, 17], 0]]],
    ['Alien', 4, [[[28, 19], main], [[26, 19], shade]],
        [[[27, 18], main], [[27, 19], shade], [[27, 20], shade], [[27, 21], main]]],
    ['Angel', 5, [[[25, 19], main]], [[27, 17], [26, 18], [27, 18], [26, 19], [27, 19], [26, 20], [27, 20]]
        .map(point => [point, main])],
    ['Dracula', 6, [[[28, 19], main], [[27, 22], shade], [[29, 274], highlight]], [
        [[26, 14], main], [[37, 14], main], [[25, 15], main], [[26, 15], highlight],
        [[37, 15], shade], [[38, 15], main], [[25, 16], main], [[26, 16], shade],
        [[27, 16], shade], [[37, 16], shade], [[38, 16], main], [[27, 17], main],
        [[27, 18], shade], [[27, 19], shade], [[27, 20], shade], [[27, 21], shade],
    ]],
    ['Hellsing', 11, [[[28, 19], main]], [[[27, 17], main]]],
    ['SnowRider', 12, [[[28, 19], main]], [[[27, 17], main]]],
];

for (const [name, id, donors, changes] of fixtures) {
    useKey(key, name + '#1C2923/0:0:0');
    itemPixels.fill(0);
    foreground.fill(0);
    for (const [point, color] of donors) itemPixels[index(...point)] = color;
    for (const [point] of changes) foreground[index(...point)] = 0xff32cc27;
    original.set(itemPixels);
    const expected = itemPixels.slice();
    for (const [point, color] of changes) if (!(drawn[index(...point)] >>> 24)) expected[index(...point)] = color;
    const foregroundBefore = foreground.slice(), sourceBefore = source.slice(), drawnBefore = drawn.slice();
    const originalBefore = original.slice();
    assert.equal(repair(key, 0, 0, 0, 0), id);
    // Apache receives an unrelated layer here to verify the companion guard.
    const companion = id >= 11 ? human : accessory;
    assert.equal(repair(key, item, companion, list, gun), id);
    assert.deepEqual(itemPixels, expected, name);
    assert.deepEqual(foreground, foregroundBefore, name + ' foreground');
    assert.deepEqual(source, sourceBefore, name + ' selected firearm');
    assert.deepEqual(drawn, drawnBefore, name + ' rendered firearm');
    assert.deepEqual(original, originalBefore, name + ' cached layer');
}
useKey(key, 'Angel#225544');
itemPixels[index(25, 19)] = main;
useLayers(item, rendered, accessory);
assert.equal(repair(key, item, 0, list, gun), 5, 'finds the firearm below foreground gear');
useLayers(item, accessory, rendered);
const before = itemPixels.slice();
assert.equal(repair(key, item, 0, list, 0), 0, 'unarmed');
assert.equal(repair(key, cached, 0, list, gun), 0, 'cached array not appended');
assert.equal(repair(key, rendered, 0, list, gun), 0, 'firearm aliases item');
useLayers(item, item, rendered);
assert.equal(repair(key, item, 0, list, gun), 0, 'duplicate item target');
useLayers(item, gun, rendered);
assert.equal(repair(key, item, 0, list, gun), 0, 'duplicate firearm');
useLayers(item, accessory, rendered);
drawn[index(0, 0)] = 0xffffffff;
assert.equal(repair(key, item, 0, list, gun), 0, 'rendered firearm does not match');
source[index(0, 0)] = 0xffffffff;
assert.equal(repair(key, item, 0, list, gun), 0, 'unrecognized firearm mask');
assert.deepEqual(itemPixels, before, 'rejected cases leave the target intact');

// The confirmed Apache fixture used to clear a pixel on the composite stack.
// On the compatibility path that erase is retired, even with Apache selected.
const legacy = new WebAssembly.Module(fs.readFileSync(
    path.join(__dirname, '../prototype/native_underlay_v106.wasm'),
));
const {phm_native_underlay: compatibility} = new WebAssembly.Instance(legacy, {env: {memory}}).exports;
const slots = [item, accessory, gun, rendered, cached];
const arrays = slots.map(array);
for (const [i, sourceLayer] of bolt.layers.entries()) {
    const {x, y, width, height, rgba} = sourceLayer;
    const data = Buffer.from(rgba, 'base64');
    arrays[i].fill(0);
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            arrays[i][index(x + col, y + row)] = data.readUInt32LE(4 * (row * width + col));
        }
    }
}
useLayers(...slots);
const originalLayers = arrays.map(pixels => pixels.slice());
for (const selection of [0, 1 << 3, 1 << 4]) {
    assert(compatibility(list, cached, selection) < 0, 'legacy Apache erase refuses to run');
    assert.deepEqual(arrays, originalLayers, 'legacy skip leaves every layer intact');
}
console.log('PASS item-key recipes, rendered firearm copy, and layer provenance guards');
