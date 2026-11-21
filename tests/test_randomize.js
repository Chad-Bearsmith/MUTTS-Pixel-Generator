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
const floats = new Float32Array(buffer);
const write = (address, value) => { words[address / 4] = value; };
function writeText(address, value) {
    write(address + 8, value.length);
    for (const [i, char] of [...value].entries()) chars[(address + 12) / 2 + i] = char.charCodeAt(0);
    return address;
}
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
    writeText(name, label);
    write(controls + 20, dropdown);
    write(options + 12, count);
    write(swatches + 12, 3);
    for (let j = 0; j < 3; j++) write(swatches + 16 + j * 4, row + 320 + j * 4);
    rows.set(label, { controls, dropdown, count, options, swatches, row });
}

const events = [], frames = [], activation = [];
let focus, selectedObject, first, draws, error, caption, moved;
const batch = { value: 0 };
const pending = { value: 0 };
const exportCaption = writeText(9024, 'Export');
const canvasName = writeText(9088, 'Canvas');
const saveName = writeText(9152, 'Save');
const presetsName = writeText(9280, 'Presets');
const lookup = (key, address) => [...rows.values()].find(row => row[key] === address);
const inBatch = (event, ...args) => {
    assert.equal(batch.value, 1);
    events.push([event, ...args]);
};
const asm = {
    mutts_editor: {value: 100},
    mutts_batch: batch,
    mutts_random_button: {value: 0},
    mutts_roll_pending: pending,
    mutts_transform: pointer => pointer === rows.get('Cape').dropdown ? 10000 : 10032,
    mutts_parent: pointer => pointer + 1,
    mutts_name: pointer => ({10004: canvasName, 10096: presetsName, 10112: saveName})[pointer],
    mutts_child: (parent, index) => ({'10004,2': 10064, '10064,0': 10096, '10064,4': 10112, '10112,0': 10144, '10032,0': 10176})[[parent, index]],
    mutts_set_active: (object, active) => activation.push([object, active]),
    mutts_caption: () => 20000,
    mutts_type: pointer => pointer === 20000 ? 1 : 2,
    mutts_game_object: pointer => pointer,
    mutts_component: (object, type) => ({'10144,1': 10200, '10112,2': 10208, '10176,1': 10216})[[object, type]],
    mutts_get_text: () => exportCaption,
    mutts_instantiate: (original, parent, worldPositionStays) => {
        assert.deepEqual([original, parent, worldPositionStays], [10208, 10064, 0]);
        return 10224;
    },
    mutts_alloc_string: length => { write(9216 + 8, length); return 9216; },
    mutts_set_text: (label, text) => {
        assert.equal(label, 10216);
        const start = (text + 12) / 2;
        caption = String.fromCharCode(...chars.subarray(start, start + words[(text + 8) / 4]));
    },
    mutts_get_position: (coordinates, original) => {
        assert.equal(original, 10112);
        floats.set([0, 25], coordinates / 4);
    },
    mutts_set_position: (clone, coordinates) => {
        assert.equal(clone, 10032);
        moved = [...floats.subarray(coordinates / 4, coordinates / 4 + 2)];
    },
    mutts_event_system: () => 10300,
    mutts_set_selected: (_events, object) => { selectedObject = object; },
    mutts_selected: () => selectedObject,
    mutts_submit: pointer => { assert.equal(pointer, 10224); pending.value++; },
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
const canvas = {matches: () => true, addEventListener: (_event, handler) => { focus = handler; }};
const alerts = [];
const window = { MUTTSSpriteAtlas: {idleFrame: () => [1]}, alert: msg => alerts.push(msg) };
vm.runInNewContext(script, {
    window,
    document: {getElementById: id => id === 'unity-canvas' && canvas},
    requestAnimationFrame: fn => frames.push(fn),
    Math: {random: () => draws++ === 0 ? first : .999, floor: Math.floor},
    console: {error() {}},
});
window.MUTTSRandomize.connect({asm, HEAPU32: words, HEAPU16: chars, HEAPF32: floats, _malloc: () => 9504, _free() {}});
frames.shift()();
assert.deepEqual(activation, [[10096, 0]], 'only the preset grid is deactivated');
assert.equal(asm.mutts_random_button.value, 10224);
assert.equal(caption, 'Randomize');
assert.deepEqual(moved, [0, 97]);
window.MUTTSRandomize.submit('Enter');
assert.equal(pending.value, 0);
focus();

for (const [choice, selectedWeapon] of [[.1, 'Weapon'], [.9, 'Firearm']]) {
    first = choice;
    draws = 0;
    events.length = 0;
    window.MUTTSRandomize.submit(' ');
    assert.equal(pending.value, 1);
    frames.shift()();
    assert.equal(pending.value, 0);
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
pending.value++;
frames.shift()();
assert.equal(alerts.length, 1);
assert.equal(batch.value, 0);
assert.deepEqual(events.at(-1), ['rebuild']);
console.log('PASS Randomize uses native item and swatch ranges, preserves hidden layers, and rebuilds once');
