"""Use freshly captured arm provenance when the composite list has no unique firearm."""
import argparse
from pathlib import Path

import patch_native_player_v96 as v96

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'prototype/native_hand_fallback_v97.wasm'
BASE_SHA256 = 'ee7748179c8cdc0a29e2ef0ac3142d4a55b13c83ea079a409ab682562d64cf2c'
wasm = v96.wasm
tail = v96.tail
BUILDER = 5031
FALLBACK_TYPE = 8
FALLBACK_SIGNATURE = bytes.fromhex('60 04 7f 7f 7f 7f 01 7f')


def build():
    baseline = v96.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    bodies = wasm.code_bodies(before[10])
    count, offset = wasm.ul(before[3], 0)
    assert count == len(bodies)
    helper = dict(wasm.sections(HELPER.read_bytes()))
    assert helper[1] == b'\x01' + FALLBACK_SIGNATURE
    assert helper[3] == b'\x01\x00'
    assert all(sid not in helper for sid in (8, 9, 11, 12))
    _, type_offset = wasm.ul(before[1], 0)
    for _ in range(FALLBACK_TYPE):
        params, type_offset = wasm.ul(before[1], type_offset + 1)
        results, type_offset = wasm.ul(before[1], type_offset + params)
        type_offset += results
    assert before[1][type_offset:type_offset + len(FALLBACK_SIGNATURE)] == FALLBACK_SIGNATURE
    bodies.append(wasm.body_from_helper(HELPER))
    helper_id = count + wasm.DEF_FUNCS
    at = BUILDER - wasm.DEF_FUNCS
    # Feed 71934's result and the firearm, scratch, and composite arrays to
    # the fallback. Its return is discarded before the geometry pass.
    old = bytes.fromhex('10 fe b1 04 1a 20 0e 20 0d 23 19 10 ff b1 04')
    new = old[:4] + bytes.fromhex('20 0d 23 19 20 0e 10') + wasm.uleb(helper_id) + old[4:]
    assert bodies[at].count(old) == 1
    bodies[at] = bodies[at].replace(old, new)
    updates = {
        3: wasm.uleb(count + 1) + before[3][offset:] + wasm.uleb(FALLBACK_TYPE),
        10: tail.code(bodies),
    }
    return tail.module((sid, updates.get(sid, content)) for sid, content in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
