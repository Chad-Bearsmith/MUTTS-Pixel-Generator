/* Use the compiled Unity editor's dropdowns and fixed-color buttons. */
(() => {
  'use strict';

  const visibleLayers = new Set([
    'Body', 'Head', 'Ears', 'Eyes', 'Mask', 'Hair', 'Armor', 'Helmet',
    'Weapon', 'Firearm', 'Shield', 'Cape', 'Back',
  ]);
  const randomIndex = count => Math.floor(Math.random() * count);

  function buildPlan(module, editor) {
    const asm = module.asm;
    const word = (pointer, offset = 0) => {
      const heap = module.HEAPU32;
      const address = pointer + offset;
      if (!pointer || address % 4 || address < 0 || address >= heap.byteLength) {
        throw Error('Unity editor control is unavailable.');
      }
      return heap[address / 4];
    };

    // Layout from the pinned IL2CPP build. List<T> stores its array and count
    // at +8 and +12. Array length is at +12 and elements start at +16.
    const list = word(editor, 16); // CharacterEditor.Layers
    const items = word(list, 8);
    const count = word(list, 12);
    if (count > word(items, 12)) throw Error('Invalid Unity layer list.');

    const plan = [];
    // Unity treats melee weapons and firearms as mutually exclusive.
    const weaponLayer = randomIndex(2) === 0 ? 'Weapon' : 'Firearm';
    for (let i = 0; i < count; ++i) {
      const layer = word(items, 16 + i * 4);
      const name = word(layer, 8); // LayerEditor.Name
      const size = word(name, 8); // String length; UTF-16 starts at +12.
      const text = module.HEAPU16;
      const start = (name + 12) / 2;
      if (size > 32 || start + size > text.length) throw Error('Invalid Unity layer name.');
      const label = String.fromCharCode(...text.subarray(start, start + size));
      if (!visibleLayers.has(label)) continue;

      const controls = word(layer, 12); // LayerEditor.Controls
      const dropdown = word(controls, 20); // LayerControls.Dropdown
      const options = asm.mutts_get_options(dropdown, 0);
      const optionCount = word(options, 12);
      const swatches = asm.mutts_get_swatches(controls);
      const swatchCount = word(swatches, 12);
      if (!optionCount || !swatchCount) throw Error('Unity item options or swatches are unavailable.');
      const weapon = label === 'Weapon' || label === 'Firearm';
      // Index zero is Empty for both weapon dropdowns. Clear the other slot
      // first, then roll the active slot from its actual list, including Empty.
      const index = weapon && label !== weaponLayer ? 0 : randomIndex(optionCount);
      const swatch = word(swatches, 16 + 4 * randomIndex(swatchCount));
      if (!swatch) throw Error('Unity color button is unavailable.');
      plan.push({ label, dropdown, index, swatch });
    }

    if (new Set(plan.map(entry => entry.label)).size !== visibleLayers.size || plan.length !== visibleLayers.size) {
      throw Error('Unity editor layers are unavailable.');
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

  function connect(module) {
    const button = document.getElementById('mutts-randomize');
    const ready = () => {
      if (module.asm.mutts_editor.value && window.MUTTSSpriteAtlas.idleFrame()) button.disabled = false;
      else requestAnimationFrame(ready);
    };
    requestAnimationFrame(ready);
    button.addEventListener('click', () => {
      button.disabled = true;
      try {
        randomize(module);
      } catch (error) {
        console.error('Randomize failed:', error);
        window.alert('Randomize could not finish.');
      } finally {
        button.disabled = false;
      }
    });
  }

  window.MUTTSRandomize = { connect };
})();
