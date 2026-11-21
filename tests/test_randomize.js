'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../game/mutts-randomize.js'), 'utf8');
const layers = ['Cape', 'Back', 'Shield', 'Body', 'Armor', 'Head', 'Horns',
    'Eyes', 'Mask', 'Hair', 'Ears', 'Helmet', 'Arms', 'Weapon', 'Firearm', 'Bracers'];
const hidden = new Set(['Arms', 'Horns', 'Bracers']);
const buffer = new ArrayBuffer(16384);
const words = new Uint32Array(buffer), chars = new Uint16Array(buffer);
const write = (address, value) => { words[address / 4] = value; };
const rows = new Map();
write(100 + 16, 200); // CharacterEditor.Layers
write(200 + 8, 300);
write(200 + 12, layers.length);
write(300 + 12, layers.length);
for (const [i, label] of layers.entries()) {
    const row = 512 + i * 512;
    const name = row + 56;
    const controls = row + 112;
    const dropdown = row + 144;
    const options = row + 192;
    const swatches = row + 240;
    const count = 2 + i;
    write(300 + 16 + i * 4, row);
    write(row + 8, name);
    write(row + 12, controls);
    write(name + 8, label.length);
    for (const [j, char] of [...label].entries()) chars[(name + 12) / 2 + j] = char.charCodeAt(0);
    write(controls + 20, dropdown);
    write(options + 12, count);
    write(swatches + 12, 3);
    for (let j = 0; j < 3; j++) write(swatches + 16 + j * 4, row + 320 + j * 4);
    rows.set(label, { controls, dropdown, count, options, swatches, row });
}

const events = [];
let click, first, draws, error;
const batch = { value: 0 };
const lookup = (key, address) => [...rows.values()].find(row => row[key] === address);
const inBatch = (event, ...args) => {
    assert.equal(batch.value, 1);
    events.push([event, ...args]);
};
const asm = {
    mutts_editor: {value: 100},
    mutts_batch: batch,
    mutts_get_options: pointer => lookup('dropdown', pointer).options,
    mutts_get_swatches: pointer => lookup('controls', pointer).swatches,
    mutts_hide_options: dropdown => inBatch('close', dropdown),
    mutts_select_item: (dropdown, index) => inBatch('select', dropdown, index),
    mutts_press_swatch: button => {
        if (error) throw Error('test failure');
        inBatch('swatch', button);
    },
    mutts_rebuild: editor => {
        assert.equal(batch.value, 0);
        assert.equal(editor, 100);
        events.push(['rebuild']);
    },
};
const button = { disabled: true, addEventListener: (_event, handler) => { click = handler; } };
const alerts = [];
const window = { MUTTSSpriteAtlas: {idleFrame: () => [1]}, alert: msg => alerts.push(msg) };
vm.runInNewContext(script, {
    window,
    document: {getElementById: id => id === 'mutts-randomize' && button},
    requestAnimationFrame: fn => fn(),
    Math: {random: () => draws++ === 0 ? first : .999, floor: Math.floor},
    console: {error() {}},
});
window.MUTTSRandomize.connect({asm, HEAPU32: words, HEAPU16: chars});
assert.equal(button.disabled, false);

for (const [choice, selectedWeapon] of [[.1, 'Weapon'], [.9, 'Firearm']]) {
    first = choice;
    draws = 0;
    events.length = 0;
    click();
    assert.equal(button.disabled, false);
    assert.equal(batch.value, 0);
    assert.equal(alerts.length, 0);
    const selected = new Map(events.filter(e => e[0] === 'select').map(([, control, index]) => [control, index]));
    const colored = events.filter(e => e[0] === 'swatch').map(([, pointer]) => pointer);
    assert.equal(selected.size, 13);
    assert.equal(colored.length, 13);
    assert.deepEqual(events.at(-1), ['rebuild']);
    assert.equal(events.filter(e => e[0] === 'rebuild').length, 1);
    for (const [label, {row, dropdown, count}] of rows) {
        if (hidden.has(label)) {
            assert.equal(selected.has(dropdown), false);
            assert.equal(colored.includes(row + 328), false);
        } else {
            const inactiveWeapon = ['Weapon', 'Firearm'].includes(label) && label !== selectedWeapon;
            assert.equal(selected.get(dropdown), inactiveWeapon ? 0 : count - 1);
            assert(colored.includes(row + 328), `${label} can roll the last actual swatch`);
        }
    }
}
error = true;
click();
assert.equal(alerts.length, 1);
assert.equal(batch.value, 0);
assert.equal(button.disabled, false);
assert.deepEqual(events.at(-1), ['rebuild']);
console.log('PASS Randomize uses native item and swatch ranges, preserves hidden layers, and rebuilds once');
