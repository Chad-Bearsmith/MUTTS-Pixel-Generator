"""Protect the Small Backpack layer from legacy Apache Armor erases."""
import argparse
from pathlib import Path

import patch_native_player_v91 as v91

ROOT = Path(__file__).resolve().parents[1]
UNDERLAY_HELPER = ROOT / 'prototype/native_underlay_v93.wasm'
PINNED_PLAYER_V92 = '69138a434f9d14ff4d6274da99d9b0f2175e845a1ab4539288440e4b1a776cf4'


def build():
    baseline = v91.build()
    assert v91.tail.sha256(baseline) == PINNED_PLAYER_V92
    wasm = v91.wasm
    sections = wasm.sections(baseline)
    bodies = wasm.code_bodies(dict(sections)[10])
    bodies[v91.UNDERLAY - wasm.DEF_FUNCS] = wasm.body_from_helper(UNDERLAY_HELPER)
    return v91.tail.module(
        (sid, v91.tail.code(bodies) if sid == 10 else data) for sid, data in sections
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', v91.tail.sha256(player))
