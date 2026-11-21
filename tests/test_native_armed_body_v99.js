'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const memory = new WebAssembly.Memory({ initial: 145 });
const bytes = fs.readFileSync(path.join(__dirname, '../prototype/native_armed_body_v99.wasm'));
const { mutts_armed_body: repair } = new WebAssembly.Instance(
    new WebAssembly.Module(bytes), { env: { memory } }
).exports;

const width = 576;
const length = width * 928;
const key = 0x1000;
const body = 0x10000;
const firearm = 0x220000;
const helmet = 0x440000;
const cachedBody = 0x660000;
const words = new Uint32Array(memory.buffer);
const chars = new Uint16Array(memory.buffer);
const pos = (x, y) => (863 - y) * width + x;
const frame = address => {
    words[(address + 12) / 4] = length;
    return new Uint32Array(memory.buffer, address + 16, length);
};
const bodyPixels = frame(body);
const gunPixels = frame(firearm);
const helmetPixels = frame(helmet);
const sourcePixels = frame(cachedBody);
const writeKey = name => {
    words[(key + 8) / 4] = name.length;
    for (let i = 0; i < name.length; i++) chars[(key + 12) / 2 + i] = name.charCodeAt(i);
};

const fixtures = [
    { item: 'Furry', main: [[27, 18], [27, 20]], shade: [[26, 19], [27, 19]], sample: [25, 19] },
    { item: 'Merman', main: [[27, 19], [26, 20], [27, 21]], shade: [[27, 20]], sample: [26, 21] },
    { item: 'Werewolf', main: [[26, 18], [27, 18], [26, 20], [27, 20]],
        shade: [[26, 19], [27, 19]], sample: [25, 19] },
];
const palettes = [[0xff000000, 0xff6e4c42], [0xff8c19e6, 0xffdcef00], [0xff000000, 0xff000000]];
for (const fixture of fixtures) {
    for (const [palette, [main, shade]] of palettes.entries()) {
        for (const blocked of [0, 254, 255]) {
            writeKey(fixture.item + '#' + palette + '/0:0:0');
            bodyPixels.fill(0);
            gunPixels.fill(0);
            helmetPixels.fill(0);
            bodyPixels[pos(28, 19)] = main;
            bodyPixels[pos(...fixture.sample)] = shade;
            bodyPixels[pos(25, 20)] = 0xff803366;
            bodyPixels[0] = 0xff256809;
            // The fix can both fill a hole and restore a distinct Body shade.
            bodyPixels[pos(...fixture.shade[0])] = 0xff12ab19;
            gunPixels[pos(...fixture.main[0])] = blocked ? (blocked << 24) | 0x7f7f7f : 0;
            helmetPixels[pos(...fixture.shade[0])] = 0xffef1255;
            sourcePixels.set(bodyPixels);
            const expected = bodyPixels.slice();
            const changes = [[fixture.main, main], [fixture.shade, shade]];
            for (const [pairs, value] of changes) {
                for (const xy of pairs) {
                    const at = pos(...xy);
                    if (!gunPixels[at]) expected[at] = value;
                }
            }
            const gunBefore = gunPixels.slice();
            const helmetBefore = helmetPixels.slice();
            const sourceBefore = sourcePixels.slice();
            const label = fixture.item + ' ' + palette + ' ' + blocked;
            assert.equal(repair(key, body, firearm), fixture.main.length + fixture.shade.length - Number(blocked !== 0), label);
            assert.deepEqual(bodyPixels, expected, label);
            assert.deepEqual(gunPixels, gunBefore, 'firearm artwork');
            assert.deepEqual(helmetPixels, helmetBefore, 'foreground equipment');
            assert.deepEqual(sourcePixels, sourceBefore, 'cached Body source');
            assert.equal(repair(key, body, firearm), 0, 'repeat rebuild');
        }
    }
}

const wantNoWrite = (name, target, gun, label) => {
    writeKey(name);
    const before = bodyPixels.slice();
    assert.equal(repair(key, target, gun), 0, label);
    assert.deepEqual(bodyPixels, before, label);
};
bodyPixels[pos(27, 18)] = 0;
wantNoWrite('Furry#FFFFFF', body, 0, 'unarmed');
wantNoWrite('Human#FFFFFF', body, firearm, 'other Body');
wantNoWrite('FurryPlus#FFFFFF', body, firearm, 'distinct Body key with common prefix');
wantNoWrite('Furry', body, firearm, 'missing key separator');
wantNoWrite('Furry#FFFFFF', firearm, firearm, 'firearm aliases the target');
wantNoWrite('Furry#FFFFFF', 0, firearm, 'owned Body unavailable');
words[(firearm + 12) / 4] = length - 1;
wantNoWrite('Furry#FFFFFF', body, firearm, 'malformed firearm');
frame(firearm);
bodyPixels[pos(25, 19)] = 0x003322ff;
wantNoWrite('Furry#FFFFFF', body, firearm, 'invalid donor alpha');
console.log('PASS all three armed Body templates, live-color fixtures, and negative controls');
