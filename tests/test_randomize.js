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
    write(row + 16, i);
    writeText(name, label);
    write(controls + 20, dropdown);
    write(controls + 24, row + 384);
    floats.set([1, 1, 1, 1], (row + 40) / 4);
    write(options + 12, count);
    write(swatches + 12, 3);
    for (let j = 0; j < 3; j++) write(swatches + 16 + j * 4, row + 320 + j * 4);
    rows.set(label, { controls, dropdown, count, options, swatches, row });
}

const events = [], frames = [], activation = [], destroyed = [], captions = [], positions = [];
let focus, selectedObject, first, draws, error, clones = 0;
const batch = { value: 0 };
const pending = { value: 0 };
const resetPending = { value: 0 };
const exportCaption = writeText(9024, 'Export');
const canvasName = writeText(9088, 'Canvas');
const saveName = writeText(9152, 'Save');
const presetsName = writeText(9280, 'Presets');
const panelChildren = [10096, 10112]; // Presets, Save
const lookup = (key, address) => [...rows.values()].find(row => row[key] === address);
const inBatch = (event, ...args) => {
    assert.equal(batch.value, 1);
    events.push([event, ...args]);
};
const asm = {
    mutts_editor: {value: 100},
    mutts_batch: batch,
    mutts_random_button: {value: 0},
    mutts_reset_button: {value: 0},
    mutts_reset_pending: resetPending,
    mutts_roll_pending: pending,
    mutts_transform: pointer => pointer === rows.get('Cape').dropdown ? 10000 : pointer === 10224 ? 10032 : 10040,
    mutts_parent: pointer => pointer + 1,
    mutts_name: pointer => ({10004: canvasName, 10096: presetsName, 10112: saveName})[pointer],
    mutts_child_count: parent => { assert.equal(parent, 10064); return panelChildren.length; },
    mutts_child: (parent, index) => parent === 10064 ? panelChildren[index] :
        ({'10004,2': 10064, '10112,0': 10144, '10032,0': 10176, '10040,0': 10184})[[parent, index]],
    mutts_set_active: (object, active) => activation.push([object, active]),
    mutts_destroy: object => {
        assert.deepEqual(activation.at(-1), [object, 0]);
        destroyed.push(object);
    },
    mutts_caption: () => 20000,
    mutts_type: pointer => pointer === 20000 ? 1 : 2,
    mutts_game_object: pointer => pointer,
    mutts_component: (object, type) => ({'10144,1': 10200, '10112,2': 10208, '10176,1': 10216, '10184,1': 10232})[[object, type]],
    mutts_get_text: () => exportCaption,
    mutts_instantiate: (original, parent, worldPositionStays) => {
        assert.deepEqual([original, parent, worldPositionStays], [10208, 10064, 0]);
        return 10224 + 16 * clones++;
    },
    mutts_alloc_string: length => { write(9216 + 8, length); return 9216; },
    mutts_set_text: (label, text) => {
        assert([10216, 10232].includes(label));
        const start = (text + 12) / 2;
        captions.push(String.fromCharCode(...chars.subarray(start, start + words[(text + 8) / 4])));
    },
    mutts_get_position: (coordinates, original) => {
        assert.equal(original, 10112);
        floats.set([0, 25], coordinates / 4);
    },
    mutts_set_position: (clone, coordinates) => {
        positions.push([clone, ...floats.subarray(coordinates / 4, coordinates / 4 + 2)]);
    },
    mutts_event_system: () => 10300,
    mutts_set_selected: (_events, object) => { selectedObject = object; },
    mutts_selected: () => selectedObject,
    mutts_submit: pointer => {
        if (pointer === 10240) resetPending.value++;
        else { assert.equal(pointer, 10224); pending.value++; }
    },
    mutts_dropdown_value: dropdown => layers.indexOf([...rows].find(([, r]) => r.dropdown === dropdown)[0]),
    mutts_layer_index: (row, i) => write(row + 16, i),
    mutts_button_event: hide => hide,
    mutts_invoke: hide => write(hide - 384 + 36, 0),
    mutts_fixed_color: (controls, rgba) => {
        const row = lookup('controls', controls).row;
        assert.equal(batch.value, 1);
        floats.set(floats.subarray(rgba / 4, rgba / 4 + 4), (row + 40) / 4);
    },
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
const moduleMock = {asm, HEAPU32: words, HEAPU16: chars, HEAPF32: floats, _malloc: () => 9504, _free() {}};
window.MUTTSRandomize.connect(moduleMock);
frames.shift()();
assert.deepEqual(activation, [[10096, 0]], 'only the preset grid is deactivated');
assert.deepEqual(destroyed, [10096], 'only the preset grid is removed');
assert.equal(asm.mutts_random_button.value, 10224);
assert.equal(asm.mutts_reset_button.value, 10240);
assert.deepEqual(captions, ['Randomize', 'Reset']);
assert.deepEqual(positions, [[10032, 0, 97], [10040, 0, 169]]);
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
for (const {row} of rows.values()) {
    write(row + 16, 1);
    write(row + 36, 1);
    floats.fill(0.25, (row + 40) / 4, (row + 56) / 4);
}
events.length = 0;
window.MUTTSRandomize.submit('ArrowUp');
window.MUTTSRandomize.submit('Enter');
assert.equal(resetPending.value, 1);
frames.shift()();
assert.equal(resetPending.value, 0);
assert.deepEqual(events.filter(e => e[0] === 'select'),
    [...rows.values()].map(({dropdown}, i) => ['select', dropdown, i]));
assert.equal(events.filter(e => e[0] === 'rebuild').length, 1);
for (const [i, {row}] of [...rows.values()].entries()) {
    assert.equal(words[(row + 16) / 4], i);
    assert.equal(words[(row + 36) / 4], 0);
    assert.deepEqual([...floats.subarray((row + 40) / 4, (row + 56) / 4)], [1, 1, 1, 1]);
}
error = true;
pending.value++;
frames.shift()();
assert.equal(alerts.length, 1);
assert.equal(batch.value, 0);
assert.deepEqual(events.at(-1), ['rebuild']);
// Save moves to index zero when the obsolete preset grid is already absent.
panelChildren.shift();
frames.length = 0;
clones = 0;
window.MUTTSRandomize.connect(moduleMock);
frames.shift()();
assert.deepEqual(captions.slice(-2), ['Randomize', 'Reset']);
assert.deepEqual(destroyed, [10096]);
console.log('PASS preset cleanup and Unity action buttons with and without the preset grid');
