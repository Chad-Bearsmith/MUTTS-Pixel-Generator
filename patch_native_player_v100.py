"""Expose Unity's existing GameObject.SetActive for the preset grid."""
import argparse
from pathlib import Path

import patch_native_player_v99 as v99

ROOT = Path(__file__).resolve().parent
BASE_SHA256 = '97d026f8a13aac43d183c8cdcb934066dfc940d0a63e40dd64a18bb04e0ee3de'
SET_ACTIVE = 2401
EXPORT = b'mutts_set_active'
wasm = v99.wasm
tail = v99.tail


def build():
    baseline = v99.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    exports = dict(sections)[7]
    count, start = wasm.ul(exports, 0)
    assert EXPORT not in exports
    entry = wasm.uleb(len(EXPORT)) + EXPORT + b'\x00' + wasm.uleb(SET_ACTIVE)
    updated = wasm.uleb(count + 1) + exports[start:] + entry
    return tail.module((sid, updated if sid == 7 else data) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
