"""Run the armed Body repair on the current Unity Body array."""
import argparse
from pathlib import Path

import patch_native_player_v98 as v98

ROOT = Path(__file__).resolve().parent
HELPER = ROOT / 'prototype/native_armed_body_v99.wasm'
BASE_SHA256 = '418af6ac95a06a0d9e02716ec31d01fad5f9c568be807761ae6513243ea9a517'
wasm = v98.wasm
tail = v98.tail


def build():
    baseline = v98.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    bodies = wasm.code_bodies(before[10])
    count, offset = wasm.ul(before[3], 0)
    assert count == len(bodies)
    helper = dict(wasm.sections(HELPER.read_bytes()))
    assert helper[1] == b'\x01\x60\x03\x7f\x7f\x7f\x01\x7f'
    memory_import = b'\x01\x03env\x06memory\x02\x00'
    assert helper[2].startswith(memory_import)
    _, end = wasm.ul(helper[2], len(memory_import))
    assert end == len(helper[2])
    assert helper[3] == b'\x01\x00'
    assert all(sid not in helper for sid in (8, 9, 11, 12))
    bodies.append(wasm.body_from_helper(HELPER))
    # Apply after the original underlay, before the existing Alien tail
    # mask. Pass the Body key (15), owned Body (16), and firearm (13).
    legacy_and_body = bytes.fromhex('20 0e 20 0d 23 19 10 ff b1 04 1a 20 10 04 40')
    repair = bytes.fromhex('20 0f 20 10 20 0d 10') + wasm.uleb(count + wasm.DEF_FUNCS) + b'\x1a'
    builder = v98.BUILDER - wasm.DEF_FUNCS
    bodies[builder] = v98.replace_once(bodies[builder], legacy_and_body, legacy_and_body + repair)
    updated = {
        3: wasm.uleb(count + 1) + before[3][offset:] + b'\x01',
        10: tail.code(bodies),
    }
    return tail.module((sid, updated.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
