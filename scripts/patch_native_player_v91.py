"""Restore tested source underlays and distinguish an absent arm overlay from a failed capture."""
import argparse
from pathlib import Path

import patch_native_player_v90 as v90

ROOT = Path(__file__).resolve().parents[1]
UNDERLAY_HELPER = ROOT / 'prototype/native_underlay_v91.wasm'
PINNED_PLAYER_V90 = '95c4ec1e0d6d187868cd83ff671c71b0fcf721cb530f4d65255511d2630b5912'
LOOKUP = 2041
BUILDER = 5031
UNDERLAY = 71935
wasm = v90.wasm
tail = v90.tail


def optional_overlay_lookup(source):
    # GetPixels uses the table lookup's index (local 5). A missing slot (-1)
    # bypasses pixel generation. Other empty results can occur after a slot
    # was found, and must still go through the original failed-capture guard.
    assert source.count(bytes.fromhex('20 05 41 7f 47 04 40')) == 1
    assert source.endswith(bytes.fromhex('20 03 41 20 6a 24 00 20 06 0b'))
    # Specialize the return value after the original stack restoration. This
    # clone is called only for the armed source108 slot. Other callers keep
    # using GetPixels and its ordinary nullable-array return.
    return source[:-3] + bytes.fromhex('41 7f 20 06 20 05 41 7f 46 1b 0b')


def builder_with_optional_overlay(body, lookup):
    # The original shadow lookup at append site 108 submits capture tag 308.
    # Submit the established absence tag 310 only for the explicit table miss.
    assert body.startswith(bytes.fromhex('03 08 7f 02 7d 05 7f'))
    old = bytes.fromhex('10 f9 0f 41 b4 02 23 19 10 fe b1 04 1a')
    assert body.count(old) == 1
    new = (
        b'\x10' + wasm.uleb(lookup) + bytes.fromhex('21 12') +  # stash lookup result in local 18
        bytes.fromhex('41 00 20 12 20 12 41 7f 46 1b') +       # capture pointer: null on miss
        bytes.fromhex('41 b6 02 41 b4 02 20 12 41 7f 46 1b') + # capture tag: 310 or 308
        old[-7:]
    )
    body = body.replace(old, new)
    return body[:5] + b'\x06' + body[6:]


def build():
    baseline = v90.build()
    assert tail.sha256(baseline) == PINNED_PLAYER_V90
    sections = wasm.sections(baseline)
    before = dict(sections)
    bodies = wasm.code_bodies(before[10])
    count, start = wasm.ul(before[3], 0)
    assert count == len(bodies)
    lookup_index = LOOKUP - wasm.DEF_FUNCS
    offset = start
    signature = None
    for i in range(count):
        kind, offset = wasm.ul(before[3], offset)
        if i == lookup_index:
            signature = kind
    assert offset == len(before[3]) and signature is not None
    bodies.append(optional_overlay_lookup(bodies[lookup_index]))
    builder = BUILDER - wasm.DEF_FUNCS
    bodies[builder] = builder_with_optional_overlay(bodies[builder], count + wasm.DEF_FUNCS)
    # Restore the source-aware underlay and use the live Dracula atlas swatch.
    bodies[UNDERLAY - wasm.DEF_FUNCS] = wasm.body_from_helper(UNDERLAY_HELPER)
    updated = {
        3: wasm.uleb(count + 1) + before[3][start:] + wasm.uleb(signature),
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
