'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const memory = new WebAssembly.Memory({ initial: 240 });
const wasm = fs.readFileSync(path.join(__dirname, '../prototype/native_hand_fallback_v97.wasm'));
const { mutts_hand_fallback: correct } = new WebAssembly.Instance(
    new WebAssembly.Module(wasm), { env: { memory } }
).exports;

const width = 576;
const length = width * 928;
const layers = 0x2000;
const firearm = 0x40000;
const copy = 0x280000;
const scratch = 0x500000;
const extra = 0xc00000;
const words = new Uint32Array(memory.buffer);
const index = (x, y) => (927 - y) * width + x;
const reference = index(27, 83) * 4;
const firearmPixels = new Uint32Array(memory.buffer, firearm + 16, length);
const copyPixels = new Uint32Array(memory.buffer, copy + 16, length);
const extraPixels = new Uint32Array(memory.buffer, extra + 16, length);
const set = (offset, value) => { words[(scratch + offset) / 4] = value; };
const skin = 0xff8ce161;
const glove = 0xff132ce6;
const otherPixel = index(23, 85);
const outsideIdle = index(27, 19);

function check({ label, count = 7, arm = skin, overlay = 0, fresh = 0, absent = 1,
    armFresh = 1, previous = 6, size = length, gun = firearm, matchingCopy = true,
    matchingExtra = false, list = [extra, copy], expected }) {
    firearmPixels.fill(0);
    const markers = Array.from({ length: count }, (_, x) => index(23 + x, 83));
    for (const pos of markers) firearmPixels[pos] = 0xfe396277;
    firearmPixels[otherPixel] = 0xff396277;
    firearmPixels[outsideIdle] = 0xfeaa4411;
    words[(firearm + 12) / 4] = size;
    copyPixels.set(firearmPixels);
    for (const pos of markers) copyPixels[pos] = 0xfe376298;
    if (!matchingCopy) copyPixels[markers[0]] = 0xff376298;
    extraPixels.set(firearmPixels);
    if (!matchingExtra) extraPixels[otherPixel] = 0xff396278;
    words[(copy + 12) / 4] = length;
    words[(extra + 12) / 4] = length;
    words[(layers + 12) / 4] = list.length;
    words.set(list, (layers + 16) / 4);
    set(446608, armFresh);
    set(446612, fresh);
    set(411668, absent);
    set(2584832 + reference, arm);
    set(4722944 + reference, overlay);
    const source = firearmPixels.slice();
    const untouched = extraPixels.slice();
    const wanted = copyPixels.slice();
    if (expected !== undefined) {
        for (const pos of markers) wanted[pos] = 0xfe000000 | (expected & 0xffffff);
    }
    assert.equal(correct(previous, gun, scratch, layers), Number(expected !== undefined), label);
    for (const [actual, want] of [[firearmPixels, source], [extraPixels, untouched], [copyPixels, wanted]]) {
        assert.equal(Buffer.compare(Buffer.from(want.buffer), Buffer.from(actual.buffer,
            actual.byteOffset, actual.byteLength)), 0, label);
    }
}

check({ label: 'uses the live base swatch for a verified missing overlay', expected: skin });
check({ label: 'uses the live overlay swatch for the nine-marker variant', count: 9,
    overlay: glove, fresh: 1, absent: 0, expected: glove });
check({ label: 'uses the base where the verified overlay is transparent',
    overlay: 0x00112233, fresh: 1, absent: 0, expected: skin });
check({ label: 'an opaque pure black glove is a valid color', overlay: 0xff000000,
    fresh: 1, absent: 0, expected: 0xff000000 });
check({ label: 'leaves a successful original correction alone', previous: 0 });
check({ label: 'leaves other original failure modes alone', previous: 5 });
check({ label: 'skips an overlay slot with unknown provenance', absent: 0 });
check({ label: 'skips a stale base sample', armFresh: 0, overlay: glove, fresh: 1 });
check({ label: 'skips a partially transparent overlay', overlay: 0x80132ce6, fresh: 1 });
check({ label: 'skips an invalid base sample', arm: 0x008ce161 });
check({ label: 'skips an unsupported firearm mask', count: 8 });
check({ label: 'skips a missing firearm', gun: 0 });
check({ label: 'skips a malformed firearm array', size: 100 });
check({ label: 'skips when no rendered layer matches', matchingCopy: false });
check({ label: 'skips when two distinct rendered layers match', matchingExtra: true });
check({ label: 'skips a malformed composite list', list: [0, copy] });
check({ label: 'uses the same rendered array if referenced twice', list: [copy, copy], expected: skin });
console.log('PASS current arm and glove swatches, marker-only writes, and fail-closed validation');
