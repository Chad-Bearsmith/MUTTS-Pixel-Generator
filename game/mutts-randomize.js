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
      controls.set(label, { row: layer, controls: word(module, layer, 12) });
    }
    if ([...visibleLayers].some(label => !controls.has(label))) throw Error('Unity editor layers are unavailable.');
    return controls;
  }

  function buildPlan(module, editor) {
    const asm = module.asm;
    const plan = [];
    // Unity treats melee weapons and firearms as mutually exclusive.
    const weaponLayer = randomIndex(2) === 0 ? 'Weapon' : 'Firearm';
    for (const [label, {controls}] of controlsFor(module, editor)) {
      if (!visibleLayers.has(label)) continue;
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

  function startupOptions(module, layers) {
    return [...layers.values()].map(({row, controls}) => {
      const dropdown = word(module, controls, 20);
      return {
        row, controls, dropdown,
        option: module.asm.mutts_dropdown_value(dropdown, 0),
        index: word(module, row, 16) | 0,
        hidden: word(module, row, 36) & 0xff, // LayerEditor.Hidden
        color: module.HEAPF32.slice((row + 40) / 4, (row + 56) / 4),
      };
    });
  }

  function reset(module, defaults) {
    const a = module.asm;
    const rgba = module._malloc(16);
    if (!rgba) throw Error('Could not restore Unity colors.');
    a.mutts_batch.value = 1;
    try {
      for (const {dropdown, option} of defaults) {
        a.mutts_hide_options(dropdown, 0);
        a.mutts_select_item(dropdown, option, 0);
      }
      for (const {row, controls, index, hidden, color} of defaults) {
        // Arms starts with an unset layer index even though its dropdown
        // displays index zero. Preserve both values from Unity's startup.
        if ((word(module, row, 16) | 0) !== index) a.mutts_layer_index(row, index, 0);
        if ((word(module, row, 36) & 0xff) !== hidden) {
          const hide = word(module, controls, 24); // LayerControls.Hide button
          a.mutts_invoke(a.mutts_button_event(hide, 0), 0);
        }
        module.HEAPF32.set(color, rgba / 4);
        a.mutts_fixed_color(controls, rgba, 0);
      }
    } finally {
      module._free(rgba);
      a.mutts_batch.value = 0;
      a.mutts_rebuild(a.mutts_editor.value, 0);
    }
  }

  function createButtons(module, layers) {
    const a = module.asm;
    const {controls} = layers.get('Cape');
    const dropdown = word(module, controls, 20);
    // The Cape dropdown lives at Canvas / Panel / Grid / Cape / Dropdown.
    // The sibling preview panel holds the original Export button (Save).
    let root = a.mutts_transform(dropdown, 0);
    for (let i = 0; i < 4 && root; ++i) root = a.mutts_parent(root, 0);
    if (!root || text(module, a.mutts_name(root, 0)) !== 'Canvas') throw Error('Unity canvas was not found.');
    const panel = a.mutts_child(root, 2, 0);
    let save = 0, presets = 0;
    for (let i = 0, count = a.mutts_child_count(panel, 0); i < count; ++i) {
      const child = a.mutts_child(panel, i, 0);
      const name = text(module, a.mutts_name(child, 0));
      if (name === 'Save') save = child;
      if (name === 'Presets') presets = child;
    }
    if (!save) throw Error('Unity Export was not found.');
    if (presets) {
      const grid = a.mutts_game_object(presets, 0);
      // Destroy is deferred by Unity. Disable input and rendering immediately.
      a.mutts_set_active(grid, 0, 0);
      a.mutts_destroy(grid, 0);
    }

    const labelType = a.mutts_type(a.mutts_caption(dropdown, 0), 0);
    const originalLabel = a.mutts_component(a.mutts_game_object(a.mutts_child(save, 0, 0), 0), labelType, 0);
    if (!originalLabel || text(module, a.mutts_get_text(originalLabel, 0)) !== 'Export') {
      throw Error('Invalid Unity Export label.');
    }
    const swatch = word(module, a.mutts_get_swatches(controls), 16);
    const buttonType = a.mutts_type(swatch, 0);
    const original = a.mutts_component(a.mutts_game_object(save, 0), buttonType, 0);
    if (!original) throw Error('Unity Export button is unavailable.');
    a.mutts_export_button.value = original;
    const coordinates = module._malloc(8);
    if (!coordinates) throw Error('Could not initialize the Unity action buttons.');
    try {
      return ['Randomize', 'Reset'].map((caption, i) => {
        const button = a.mutts_instantiate(original, panel, 0, 0);
        if (!button) throw Error('Could not clone the Unity Export button.');
        const rect = a.mutts_transform(button, 0);
        a.mutts_get_position(coordinates, save, 0);
        // The original is 64 Unity units tall. Leave an 8-unit gap.
        module.HEAPF32[coordinates / 4 + 1] += 72 * (i + 1);
        a.mutts_set_position(rect, coordinates, 0);
        const child = a.mutts_child(rect, 0, 0);
        const label = a.mutts_component(a.mutts_game_object(child, 0), labelType, 0);
        const string = a.mutts_alloc_string(caption.length, 0);
        for (let j = 0; j < caption.length; ++j) module.HEAPU16[(string + 12) / 2 + j] = caption.charCodeAt(j);
        a.mutts_set_text(label, string, 0);
        return button;
      });
    } finally {
      module._free(coordinates);
    }
  }

  async function connect(module) {
    const a = module.asm;
    const canvas = document.getElementById('unity-canvas');
    if (!canvas || !a.mutts_random_button || !a.mutts_reset_button || !a.mutts_export_button ||
        !a.mutts_export_pending || typeof window.MUTTSExport?.download !== 'function') {
      throw Error('Unity editor controls are unavailable.');
    }
    while (!a.mutts_editor.value || !window.MUTTSSpriteAtlas.idleFrame()) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const layers = controlsFor(module, a.mutts_editor.value);
    const defaults = startupOptions(module, layers);
    const [randomButton, resetButton] = createButtons(module, layers);
    a.mutts_random_button.value = randomButton;
    a.mutts_reset_button.value = resetButton;
    const randomObject = a.mutts_game_object(randomButton, 0);
    const resetObject = a.mutts_game_object(resetButton, 0);
    const exportButton = a.mutts_export_button.value;
    const exportObject = a.mutts_game_object(exportButton, 0);
    const buttons = [resetButton, randomButton, exportButton];
    const objects = [resetObject, randomObject, exportObject];
    const focusButton = object => {
      const events = a.mutts_event_system(0);
      if (events) a.mutts_set_selected(events, object, 0);
    };
    canvas.addEventListener('focus', () => {
      if (canvas.matches(':focus-visible')) focusButton(randomObject);
    });
    submit = key => {
      const moving = key === 'ArrowUp' || key === 'ArrowDown';
      if (!moving && key !== 'Enter' && key !== ' ') return;
      const events = a.mutts_event_system(0);
      if (!events) return;
      const selected = objects.indexOf(a.mutts_selected(events, 0));
      if (moving) {
        const next = selected < 0 ? (key === 'ArrowUp' ? 0 : 1) :
          Math.max(0, Math.min(objects.length - 1, selected + (key === 'ArrowUp' ? -1 : 1)));
        focusButton(objects[next]);
      } else if (selected >= 0) {
        a.mutts_submit(buttons[selected], 0, 0);
      }
    };
    const poll = () => {
      requestAnimationFrame(poll);
      if (a.mutts_export_pending.value) {
        a.mutts_export_pending.value = 0;
        window.MUTTSExport.download();
      }
      const resetting = a.mutts_reset_pending.value;
      if (resetting) {
        a.mutts_reset_pending.value = 0;
        a.mutts_roll_pending.value = 0;
      } else {
        if (!a.mutts_roll_pending.value) return;
        a.mutts_roll_pending.value--;
      }
      const action = resetting ? 'Reset' : 'Randomize';
      try {
        if (resetting) reset(module, defaults);
        else randomize(module);
      } catch (error) {
        console.error(action + ' failed:', error);
        window.alert(action + ' could not finish.');
      } finally {
        focusButton(resetting ? resetObject : randomObject);
      }
    };
    requestAnimationFrame(poll);
  }

  window.MUTTSRandomize = { build: 106, connect, submit: key => submit(key) };
})();
