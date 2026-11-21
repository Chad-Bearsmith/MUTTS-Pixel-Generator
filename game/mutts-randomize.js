/* Use the compiled Unity editor's dropdowns and fixed-color buttons. */
(() => {
  'use strict';

  const visibleLayers = new Set([
    'Body', 'Head', 'Ears', 'Eyes', 'Mask', 'Hair', 'Armor', 'Helmet',
    'Weapon', 'Firearm', 'Shield', 'Cape', 'Back',
  ]);
  const randomIndex = count => Math.floor(Math.random() * count);
  let submit = () => {};

  function word(module, pointer, offset = 0) {
    const heap = module.HEAPU32;
    const address = pointer + offset;
    if (!pointer || address % 4 || address < 0 || address >= heap.byteLength) {
      throw Error('Unity editor control is unavailable.');
    }
    return heap[address / 4];
  }

  function text(module, pointer) {
    const size = word(module, pointer, 8);
    const heap = module.HEAPU16;
    const start = (pointer + 12) / 2;
    if (size > 32 || start + size > heap.length) throw Error('Invalid Unity control name.');
    return String.fromCharCode(...heap.subarray(start, start + size));
  }

  function controlsFor(module, editor) {
    // Layout from the pinned IL2CPP build. List<T> stores its array and count
    // at +8 and +12. Array length is at +12 and elements start at +16.
    const list = word(module, editor, 16); // CharacterEditor.Layers
    const items = word(module, list, 8);
    const count = word(module, list, 12);
    if (count > word(module, items, 12)) throw Error('Invalid Unity layer list.');
    const controls = new Map();
    for (let i = 0; i < count; ++i) {
      const layer = word(module, items, 16 + i * 4);
      const label = text(module, word(module, layer, 8)); // LayerEditor.Name
      if (visibleLayers.has(label)) controls.set(label, word(module, layer, 12));
    }
    if (controls.size !== visibleLayers.size) throw Error('Unity editor layers are unavailable.');
    return controls;
  }

  function buildPlan(module, editor) {
    const asm = module.asm;
    const plan = [];
    // Unity treats melee weapons and firearms as mutually exclusive.
    const weaponLayer = randomIndex(2) === 0 ? 'Weapon' : 'Firearm';
    for (const [label, controls] of controlsFor(module, editor)) {
      const dropdown = word(module, controls, 20); // LayerControls.Dropdown
      const options = asm.mutts_get_options(dropdown, 0);
      const optionCount = word(module, options, 12);
      const swatches = asm.mutts_get_swatches(controls);
      const swatchCount = word(module, swatches, 12);
      if (!optionCount || !swatchCount) throw Error('Unity item options or swatches are unavailable.');
      const weapon = label === 'Weapon' || label === 'Firearm';
      // Index zero is Empty for both weapon dropdowns. Clear the other slot
      // first, then roll the active slot from its actual list, including Empty.
      const index = weapon && label !== weaponLayer ? 0 : randomIndex(optionCount);
      const swatch = word(module, swatches, 16 + 4 * randomIndex(swatchCount));
      if (!swatch) throw Error('Unity color button is unavailable.');
      plan.push({ label, dropdown, index, swatch });
    }

    return plan;
  }

  function randomize(module) {
    const asm = module.asm;
    const editor = asm.mutts_editor.value >>> 0;
    const plan = buildPlan(module, editor);
    const weapon = plan.find(entry => (entry.label === 'Weapon' || entry.label === 'Firearm') && entry.index);
    asm.mutts_batch.value = 1;
    try {
      for (const {dropdown, index, label} of plan) {
        asm.mutts_hide_options(dropdown, 0);
        const weaponSlot = label === 'Weapon' || label === 'Firearm';
        asm.mutts_select_item(dropdown, weaponSlot ? 0 : index, 0);
      }
      if (weapon) asm.mutts_select_item(weapon.dropdown, weapon.index, 0);
      for (const {swatch} of plan) asm.mutts_press_swatch(swatch, 0);
    } finally {
      asm.mutts_batch.value = 0;
      asm.mutts_rebuild(editor, 0);
    }
  }

  function createButton(module, editor) {
    const a = module.asm;
    const controls = controlsFor(module, editor).get('Cape');
    const dropdown = word(module, controls, 20);
    // The Cape dropdown lives at Canvas / Panel / Grid / Cape / Dropdown.
    // The sibling preview panel holds the original Export button (Save).
    let root = a.mutts_transform(dropdown, 0);
    for (let i = 0; i < 4 && root; ++i) root = a.mutts_parent(root, 0);
    if (!root || text(module, a.mutts_name(root, 0)) !== 'Canvas') throw Error('Unity canvas was not found.');
    const panel = a.mutts_child(root, 2, 0);
    const save = a.mutts_child(panel, 4, 0);
    if (text(module, a.mutts_name(save, 0)) !== 'Save') throw Error('Unity Export was not found.');

    const labelType = a.mutts_type(a.mutts_caption(dropdown, 0), 0);
    const originalLabel = a.mutts_component(a.mutts_game_object(a.mutts_child(save, 0, 0), 0), labelType, 0);
    if (!originalLabel || text(module, a.mutts_get_text(originalLabel, 0)) !== 'Export') {
      throw Error('Invalid Unity Export label.');
    }
    const swatch = word(module, a.mutts_get_swatches(controls), 16);
    const buttonType = a.mutts_type(swatch, 0);
    const original = a.mutts_component(a.mutts_game_object(save, 0), buttonType, 0);
    if (!original) throw Error('Unity Export button is unavailable.');
    const coordinates = module._malloc(8);
    if (!coordinates) throw Error('Could not initialize the Unity Randomize button.');
    try {
      const button = a.mutts_instantiate(original, panel, 0, 0);
      if (!button) throw Error('Could not clone the Unity Export button.');
      a.mutts_random_button.value = button;
      const rect = a.mutts_transform(button, 0);
      a.mutts_get_position(coordinates, save, 0);
      // The original is 64 Unity units tall. Leave an 8-unit gap.
      module.HEAPF32[coordinates / 4 + 1] += 72;
      a.mutts_set_position(rect, coordinates, 0);
      const child = a.mutts_child(rect, 0, 0);
      const label = a.mutts_component(a.mutts_game_object(child, 0), labelType, 0);
      const caption = 'Randomize';
      const string = a.mutts_alloc_string(caption.length, 0);
      for (let i = 0; i < caption.length; ++i) module.HEAPU16[(string + 12) / 2 + i] = caption.charCodeAt(i);
      a.mutts_set_text(label, string, 0);
      return button;
    } finally {
      module._free(coordinates);
    }
  }

  function connect(module) {
    const a = module.asm;
    let buttonObject = 0;
    const focusButton = () => {
      const events = a.mutts_event_system(0);
      if (events) a.mutts_set_selected(events, buttonObject, 0);
    };
    const ready = () => {
      if (!a.mutts_editor.value || !window.MUTTSSpriteAtlas.idleFrame()) {
        requestAnimationFrame(ready);
        return;
      }
      const button = createButton(module, a.mutts_editor.value);
      buttonObject = a.mutts_game_object(button, 0);
      const canvas = document.getElementById('unity-canvas');
      canvas.addEventListener('focus', () => {
        if (canvas.matches(':focus-visible')) focusButton();
      });
      submit = key => {
        if (key !== 'Enter' && key !== ' ') return;
        const events = a.mutts_event_system(0);
        if (events && a.mutts_selected(events, 0) === buttonObject) a.mutts_submit(button, 0, 0);
      };
      requestAnimationFrame(poll);
    };
    const poll = () => {
      requestAnimationFrame(poll);
      const pending = a.mutts_roll_pending.value;
      if (!pending) return;
      a.mutts_roll_pending.value = pending - 1;
      try {
        randomize(module);
      } catch (error) {
        console.error('Randomize failed:', error);
        window.alert('Randomize could not finish.');
      } finally {
        focusButton();
      }
    };
    requestAnimationFrame(ready);
  }

  window.MUTTSRandomize = { connect, submit: key => submit(key) };
})();
