"""Route the Unity Export button to the local PNG exporter."""
import argparse
from pathlib import Path

import patch_native_player_v103 as v103

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = '72e2bb6e525d4da54ba92d0e19314aa2f5413182ceb02e754e285439e8e3b142'
BUTTON_PRESS = v103.v101.BUTTON_PRESS
wasm = v103.wasm
tail = v103.tail


def build():
    baseline = v103.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    count, start = wasm.ul(before[6], 0)
    button, pending = wasm.uleb(count), wasm.uleb(count + 1)
    globals_section = wasm.uleb(count + 2) + before[6][start:] + b'\x7f\x01\x41\x00\x0b' * 2

    bodies = wasm.code_bodies(before[10])
    press = BUTTON_PRESS - wasm.DEF_FUNCS
    # Match the existing Button.Press dispatch after the interactability checks.
    # The registered Export button signals a browser PNG download before onClick.
    invoke = bytes.fromhex('41 f8 93 be 01 28 02 00 20 00 41 00 10 93 19')
    signal = b'\x20\x00\x23' + button + b'\x46\x04\x40\x41\x01\x24' + pending + b'\x0f\x0b'
    assert bodies[press].count(invoke) == 1
    bodies[press] = bodies[press].replace(invoke, signal + invoke)

    exports, start = wasm.ul(before[7], 0)
    exports_section = bytearray(wasm.uleb(exports + 2) + before[7][start:])
    for label, index in ((b'mutts_export_button', button), (b'mutts_export_pending', pending)):
        exports_section.extend(wasm.uleb(len(label)) + label + b'\x03' + index)
    updates = {6: globals_section, 7: bytes(exports_section), 10: tail.code(bodies)}
    return tail.module((sid, updates.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
