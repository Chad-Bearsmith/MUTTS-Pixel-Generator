'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pixels = 576 * 928;
const idle = (x, y) => (863 - y) * 576 + x;

// Nonzero-alpha rows from the original Texture2D assets. Bit zero is x=20.
const alien = { first: 15, rows: [0x1c, 0x3c, 0xff38, 0xff78, 0xff78, 0xff70, 0xff60, 0xe700, 0xc300] };
const bodies = [
    { name: 'Lizard and Fire Lizard', first: 17, rows: [0xff80, 0xffc0, 0xffe0, 0xfff0, 0xfff8, 0xe7f8, 0xc300], tail: 14 },
    { name: 'Merman', first: 17, rows: [0xff00, 0xff00, 0xff00, 0xff00, 0xff60, 0xe770, 0xc330], tail: 7 },
    { name: 'Furry', first: 14, rows: [0x18, 0x3c, 0x3c, 0xff3c, 0xff7c, 0xff78, 0xff70, 0xff00, 0xe700, 0xc300], tail: 26 },
    { name: 'Werewolf', first: 15, rows: [0xc, 0x1c, 0xff3c, 0xff3c, 0xff38, 0xff30, 0xff00, 0xe700, 0xc300], tail: 18 },
];

async function run() {
    const memory = new WebAssembly.Memory({ initial: 145 });
    const helper = process.argv[2] || path.join(__dirname, '../prototype/native_alien_body_tail_v90.wasm');
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(helper), { env: { memory } });
    const apply = instance.exports.phm_alien_body_tail;
    const body = 0x10000;
    const armor = 0x220000;
    const copy = 0x430000;
    const firearm = 0x640000;
    const data = new Uint32Array(memory.buffer);
    const view = ptr => data.subarray((ptr + 16) / 4, (ptr + 16) / 4 + pixels);
    const load = (ptr, shape, rgba) => {
        data[(ptr + 12) / 4] = pixels;
        const frame = view(ptr);
        frame.fill(0);
        frame[0] = 0xff987654; // Another tile of the atlas
        shape.rows.forEach((row, offset) => {
            for (let bit = 0; bit < 20; ++bit) {
                if (row & (1 << bit)) frame[idle(20 + bit, shape.first + offset)] = rgba;
            }
        });
        return frame;
    };

    for (const shape of bodies) {
        for (const swatch of [0xff134567, 0xff000000]) {
            const bodyFrame = load(body, shape, swatch);
            const armorFrame = load(armor, alien, 0xff4e2f2a);
            const copyFrame = load(copy, shape, swatch);
            const firearmFrame = load(firearm, { first: 22, rows: [0x20] }, 0xfe000055);
            const beforeArmor = armorFrame.slice();
            const beforeFirearm = firearmFrame.slice();
            const expected = bodyFrame.slice();
            let cleared = 0;
            for (let y = 0; y < 64; ++y) {
                for (let x = 0; x < 27; ++x) {
                    const index = idle(x, y);
                    if (!expected[index]) continue;
                    expected[index] = 0;
                    ++cleared;
                }
            }
            assert.equal(cleared, shape.tail);
            const bodyBefore = bodyFrame.slice();
            assert.equal(apply(body, 0, 0), 1, 'eligible Body clone query');
            assert.deepEqual(bodyFrame, bodyBefore, 'query leaves cached source intact');
            assert.equal(apply(body, copy, armor), 1);
            assert.deepEqual(copyFrame, expected, shape.name);
            assert.deepEqual(bodyFrame, bodyBefore, 'cached Body restores on unequip');
            assert.deepEqual(armorFrame, beforeArmor, 'Alien artwork');
            assert.deepEqual(firearmFrame, beforeFirearm, 'firearm artwork');
        }
    }

    const checkSkip = (bodyPtr, copyPtr, armorPtr, label) => {
        const before = data.slice();
        assert.equal(apply(bodyPtr, copyPtr, armorPtr), 0);
        assert.deepEqual(data, before, label);
    };
    const source = load(body, bodies[1], 0xff134567);
    const destination = load(copy, bodies[1], 0xff134567);
    const armorFrame = load(armor, alien, 0xff4e2f2a);
    checkSkip(body, copy, 0, 'no armor array');
    checkSkip(0, copy, armor, 'no Body array');
    checkSkip(body, 0, armor, 'no private Body copy');
    checkSkip(body, body, armor, 'copy aliases cached Body');
    checkSkip(body, armor, armor, 'copy aliases Armor');
    data[(armor + 12) / 4] = pixels - 1;
    checkSkip(body, copy, armor, 'invalid armor array length');
    load(armor, alien, 0xff4e2f2a)[idle(23, 15)] = 0;
    checkSkip(body, copy, armor, 'different armor silhouette');
    load(armor, alien, 0xff4e2f2a);
    source[idle(21, 15)] = 0xff000000;
    checkSkip(body, copy, armor, 'unverified Body silhouette');
    source[idle(21, 15)] = 0;

    // Legacy underlay pixels in the Armor cache preserve Alien identity.
    for (let y = 18; y <= 21; ++y) armorFrame[idle(27, y)] = 0xff556677;
    const priorArmor = armorFrame.slice();
    destination[idle(25, 21)] = 0xff112233;
    const expected = destination.slice();
    for (const [x, y] of [[26,21], [24,22], [25,22], [26,22], [24,23], [25,23]]) {
        expected[idle(x, y)] = 0;
    }
    assert.equal(apply(body, copy, armor), 1);
    assert.deepEqual(armorFrame, priorArmor);
    assert.deepEqual(destination, expected, 'preserve a replacement pixel of different provenance');

    console.log('PASS Alien Body tails, swatches, all other atlas bytes, and unsupported layer inputs');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
