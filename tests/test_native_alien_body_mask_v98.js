'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const width = 576;
const pixels = width * 928;
const memory = new WebAssembly.Memory({ initial: 105 });
const helper = fs.readFileSync(path.join(__dirname, '../prototype/native_alien_body_mask_v98.wasm'));
const { mutts_alien_body_mask: apply } = new WebAssembly.Instance(
    new WebAssembly.Module(helper), { env: { memory } }
).exports;

const bodyKey = 0x1000;
const armorKey = 0x1100;
const bodyCopy = 0x10000;
const source = 0x230000;
const foreground = 0x440000;
const words = new Uint32Array(memory.buffer);
const chars = new Uint16Array(memory.buffer);
const idle = (x, y) => (863 - y) * width + x;
const atlas = address => new Uint32Array(memory.buffer, address + 16, pixels);
const copy = atlas(bodyCopy);
const writeKey = (address, text) => {
    words[(address + 8) / 4] = text.length;
    for (let i = 0; i < text.length; i++) chars[(address + 12) / 2 + i] = text.charCodeAt(i);
};

// Pixel locations from the original Body atlases. Include adjacent pixels
// in the test's input even where an actual Body would be transparent.
const lizard = [[18, 26, 26], [19, 25, 26], [20, 24, 26], [21, 23, 26], [22, 23, 26]];
const masks = [
    ['Lizard', lizard, 14],
    ['FireLizard', lizard, 14],
    ['Merman', [[21, 25, 26], [22, 24, 26], [23, 24, 25]], 7],
    ['Furry', [[14, 23, 24], [15, 22, 25], [16, 22, 25], [17, 22, 25], [18, 22, 26],
        [19, 23, 26], [20, 24, 26]], 26],
    ['Werewolf', [[15, 22, 23], [16, 22, 24], [17, 22, 25], [18, 22, 25], [19, 23, 25],
        [20, 24, 25]], 18],
];

const original = atlas(source);
const drawnAbove = atlas(foreground);
original.fill(0xff8c1133);
drawnAbove.fill(0xfebc23a1);
words[(bodyCopy + 12) / 4] = pixels;
for (const [name, rows, count] of masks) {
    for (const [bodySwatch, armorSwatch] of [['BF6F4A', '0098DC'], ['C64524', '622461'], ['000000', '000000']]) {
        writeKey(bodyKey, name + '#' + bodySwatch + '/0:0:0');
        writeKey(armorKey, 'Alien#' + armorSwatch + '/0:0:0');
        copy.set(original);
        const expected = original.slice();
        let cleared = 0;
        for (const [y, start, end] of rows) {
            for (let x = start; x <= end; x++) {
                const index = idle(x, y);
                copy[index] = 0xff000000 + index; // An earlier correction replaced its color.
                expected[index] = 0;
                cleared++;
            }
        }
        assert.equal(cleared, count, name);
        assert.equal(apply(bodyKey, armorKey, 0), 1, name + ' clone eligibility');
        assert.equal(apply(bodyKey, armorKey, bodyCopy), 1);
        assert.deepEqual(copy, expected, name + ' masks only the tail on the Body copy');
        assert(original.every(color => color === 0xff8c1133), 'cached Body source');
        assert(drawnAbove.every(color => color === 0xfebc23a1), 'other equipment and firearm');
    }
}

function skip(body, armor, label, address = bodyCopy) {
    writeKey(bodyKey, body);
    writeKey(armorKey, armor);
    copy.set(original);
    assert.equal(apply(bodyKey, armorKey, address), 0, label);
    assert.deepEqual(copy, original, label);
}

skip('Werewolf#FFFFFF/0:0:0', 'Apache#FFFFFF/0:0:0', 'other Armor');
assert.equal(apply(bodyKey, armorKey, 0), 1, 'other Armor still gets an owned Body for old underlays');
skip('Furry#FFFFFF/0:0:0', '', 'unequipped Armor restores the Body from the original');
skip('Human#FFFFFF/0:0:0', 'Alien#FFFFFF/0:0:0', 'other Body even with visible pixels at the same sites');
skip('FireLizardPlus#FFFFFF/0:0:0', 'Alien#FFFFFF/0:0:0', 'distinct Body key with common prefix');
skip('Merman#FFFFFF/0:0:0', 'Alien Costume#FFFFFF/0:0:0', 'distinct Armor key with common prefix');
skip('Lizard', 'Alien#FFFFFF/0:0:0', 'malformed Body key');
skip('Lizard#FFFFFF/0:0:0', 'Alien#FFFFFF/0:0:0', 'invalid managed pointer', 0xffffffff);
words[(bodyCopy + 12) / 4] = pixels - 1;
skip('Furry#FFFFFF/0:0:0', 'Alien#FFFFFF/0:0:0', 'malformed atlas');

console.log('PASS exact Alien Armor Body masks, replaced tail pixels, and negative controls');
