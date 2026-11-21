"""Route the native Reset button and expose Unity editor reset operations."""
import argparse
from pathlib import Path

import patch_native_player_v100 as v100

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = 'b7627d1780d5266fbd054adb2107e587ce545230f0d2490eb1a741f23b929022'
BUTTON_PRESS = 17081
wasm = v100.wasm
tail = v100.tail


def build():
    baseline = v100.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    bodies = wasm.code_bodies(before[10])
    globals_count, start = wasm.ul(before[6], 0)
    button = wasm.uleb(globals_count)
    pending = wasm.uleb(globals_count + 1)
    # Button.Press already checked that the button is active and interactable.
    # Handle the Reset clone before Unity invokes the original Export event.
    invoke = bytes.fromhex('41 f8 93 be 01 28 02 00 20 00 41 00 10 93 19')
    signal = (
        b'\x20\x00\x23' + button + b'\x46\x04\x40\x41\x01\x24' + pending +
        b'\x0f\x0b'
    )
    press = BUTTON_PRESS - wasm.DEF_FUNCS
    assert bodies[press].count(invoke) == 1
    bodies[press] = bodies[press].replace(invoke, signal + invoke)
    globals_section = wasm.uleb(globals_count + 2) + before[6][start:] + b'\x7f\x01\x41\x00\x0b' * 2
    exports = (
        ('mutts_reset_button', 3, globals_count),
        ('mutts_reset_pending', 3, globals_count + 1),
        ('mutts_dropdown_value', 0, 6774),  # Dropdown.value getter
        ('mutts_layer_index', 0, 807),  # LayerEditor.SetIndex
        ('mutts_fixed_color', 0, 22142),  # LayerControls.SelectFixedColor
        ('mutts_button_event', 0, 5576),  # Button.onClick getter
        ('mutts_invoke', 0, 5958),  # UnityEvent.Invoke
    )
    count, start = wasm.ul(before[7], 0)
    exports_section = bytearray(wasm.uleb(count + len(exports)) + before[7][start:])
    for name, kind, index in exports:
        label = name.encode('ascii')
        exports_section.extend(wasm.uleb(len(label)) + label + bytes([kind]) + wasm.uleb(index))
    updates = {6: globals_section, 7: bytes(exports_section), 10: tail.code(bodies)}
    return tail.module((sid, updates.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
