"""Expose the Unity methods that remove obsolete preset objects at startup."""
import argparse
from pathlib import Path

import patch_native_player_v101 as v101

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = 'b40d239923a3b06e0760f5ae56fd6de1ffe65bfaca23491b975ab17bc393e968'
wasm = v101.wasm
tail = v101.tail
EXPORTS = {
    'mutts_child_count': 2874,  # Transform.childCount
    'mutts_destroy': 3575,  # Object.Destroy(Object)
}


def build():
    baseline = v101.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    exports = dict(sections)[7]
    count, start = wasm.ul(exports, 0)
    updated = bytearray(wasm.uleb(count + len(EXPORTS)) + exports[start:])
    for name, index in EXPORTS.items():
        label = name.encode('ascii')
        assert label not in exports
        updated.extend(wasm.uleb(len(label)) + label + b'\x00' + wasm.uleb(index))
    return tail.module((sid, updated if sid == 7 else data) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
