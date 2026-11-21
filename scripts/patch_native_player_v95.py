"""Expose the pinned Unity editor's controls for the Randomize button."""
import argparse
from pathlib import Path

import patch_native_player_v93 as v93

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = '388ccad1175d687d8885fccf5442c7bb9ed5baddc087a2d81ab3b96ac15adfe7'
wasm = v93.v91.wasm
tail = v93.v91.tail
EDITOR_START = 50008
EDITOR_REBUILD = 5032
LAYER_CONTROLS_START = 50040
UI_EXPORTS = {
    'mutts_get_options': 71343,  # Dropdown.get_options
    'mutts_select_item': 4190,   # Dropdown.set_value
    'mutts_hide_options': 11202, # Dropdown.Hide
    'mutts_press_swatch': 17081, # Button.Press
    'mutts_rebuild': EDITOR_REBUILD,
}


def inject_after_locals(body, instructions):
    count, offset = wasm.ul(body, 0)
    for _ in range(count):
        _, offset = wasm.ul(body, offset)
        offset += 1
    return body[:offset] + instructions + body[offset:]


def build():
    baseline = v93.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    original = dict(sections)
    bodies = wasm.code_bodies(original[10])
    count, first = wasm.ul(original[3], 0)
    assert count == len(bodies)
    new_helper = count + wasm.DEF_FUNCS

    # Copy the exact GetComponentsInChildren<Button>(false) expression from
    # LayerControls.Start. Its local 1 holds the initialized generic method.
    start = bodies[LAYER_CONTROLS_START - wasm.DEF_FUNCS]
    enumerate_buttons = bytes.fromhex(
        '20 00 28 02 2c 41 00 41 d0 a1 bc 01 28 02 00 22 01 '
        '28 02 1c 28 02 00 20 01 28 02 1c 28 02 00 28 02 04 11 01 00'
    )
    assert start.count(enumerate_buttons) == 1
    bodies.append(b'\x01\x01\x7f' + enumerate_buttons + b'\x0b')

    globals_count, first_global = wasm.ul(original[6], 0)
    editor_slot, batch_slot = globals_count, globals_count + 1
    start_idx = EDITOR_START - wasm.DEF_FUNCS
    rebuild_idx = EDITOR_REBUILD - wasm.DEF_FUNCS
    # Capture the current CharacterEditor, owned by Unity. Suppress Rebuild
    # during the synchronous randomization only and let JS call it once after.
    bodies[start_idx] = inject_after_locals(
        bodies[start_idx], b'\x20\x00\x24' + wasm.uleb(editor_slot)
    )
    bodies[rebuild_idx] = inject_after_locals(
        bodies[rebuild_idx], b'\x23' + wasm.uleb(batch_slot) + b'\x04\x40\x0f\x0b'
    )

    exports_count, first_export = wasm.ul(original[7], 0)
    entries = [(name, 0, index) for name, index in UI_EXPORTS.items()] + [
        ('mutts_get_swatches', 0, new_helper),
        ('mutts_editor', 3, editor_slot),
        ('mutts_batch', 3, batch_slot),
    ]
    exports = bytearray(wasm.uleb(exports_count + len(entries)) + original[7][first_export:])
    for name, kind, index in entries:
        label = name.encode('ascii')
        exports.extend(wasm.uleb(len(label)) + label + bytes([kind]) + wasm.uleb(index))

    # Use the existing (i32)->i32 type for the additional accessor.
    type_count, offset = wasm.ul(original[1], 0)
    unary = None
    for index in range(type_count):
        assert original[1][offset] == 0x60
        args, offset = wasm.ul(original[1], offset + 1)
        params = original[1][offset:offset + args]
        results, offset = wasm.ul(original[1], offset + args)
        returns = original[1][offset:offset + results]
        offset += results
        if params == returns == b'\x7f':
            unary = index
            break
    assert unary is not None
    updates = {
        3: wasm.uleb(count + 1) + original[3][first:] + wasm.uleb(unary),
        6: wasm.uleb(globals_count + 2) + original[6][first_global:] + b'\x7f\x01\x41\x00\x0b' * 2,
        7: bytes(exports),
        10: tail.code(bodies),
    }
    return tail.module((sid, updates.get(sid, value)) for sid, value in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
