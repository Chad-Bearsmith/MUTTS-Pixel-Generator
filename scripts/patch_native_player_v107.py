"""Map compacted Armor and Helmet dropdown indices to their original item IDs."""
import argparse
from pathlib import Path

import patch_native_player_v106 as v106
from patch_native_player_v95 import inject_after_locals

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = '81b83e58943dba4660915afa972d7e08f03a35156eb8e7cfe43c112cec90eb0c'
INT_EVENT_INVOKE = 5959
wasm = v106.wasm
tail = v106.tail


def remap(global_index):
    get_map = b'\x23' + wasm.uleb(global_index)
    # The map contains the exact onValueChanged event address, count,
    # and original option indices.
    return (get_map + b'\x04\x40\x20\x00' + get_map +
            bytes.fromhex('28 02 00 46 04 40 20 01') + get_map +
            bytes.fromhex('28 02 04 49 04 40') + get_map +
            bytes.fromhex('20 01 41 02 74 6a 28 02 08 21 01 0b 0b 0b'))


def build():
    baseline = v106.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    globals_count, start = wasm.ul(before[6], 0)
    globals_section = wasm.uleb(globals_count + 2) + before[6][start:] + b'\x7f\x01\x41\x00\x0b' * 2
    exports_count, start = wasm.ul(before[7], 0)
    exports = bytearray(wasm.uleb(exports_count + 2) + before[7][start:])
    for offset, name in enumerate((b'mutts_armor_map', b'mutts_helmet_map')):
        exports.extend(wasm.uleb(len(name)) + name + b'\x03' + wasm.uleb(globals_count + offset))

    bodies = wasm.code_bodies(before[10])
    index = INT_EVENT_INVOKE - wasm.DEF_FUNCS
    # Programmatic setting and pointer selection take different compiled
    # paths to UnityEvent<int>.Invoke. Both keep the displayed index intact.
    bodies[index] = inject_after_locals(bodies[index], remap(globals_count) + remap(globals_count + 1))
    updates = {6: globals_section, 7: bytes(exports), 10: tail.code(bodies)}
    return tail.module((sid, updates.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
