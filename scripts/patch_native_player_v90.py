"""Rebuild the v.90 player module with the v.87 underlay and no diagnostic exports."""
import argparse
from pathlib import Path

import patch_native_alien_tail_v90 as tail

ROOT = Path(__file__).resolve().parents[1]
PINNED_V90 = 'ce947694821cffe11f53a7c0659face2534f9fff73a7791578a971b0fcae2ecd'
PINNED_V87 = '0c47dc29fec0446fa5e8a632f24ec6d663e0c33eabfccb1d9e3322980e698486'
wasm = tail.v89


def player_exports(contents):
    count, offset = wasm.ul(contents, 0)
    exports = []
    for _ in range(count):
        start = offset
        length, name_start = wasm.ul(contents, offset)
        name_end = name_start + length
        name = contents[name_start:name_end]
        _, offset = wasm.ul(contents, name_end + 1)
        if name == b'phm_v64_snapshot_destination':
            # This buffer is also required for accepted hand-color correction.
            name = b'phm_hand_scratch'
            exports.append(wasm.uleb(len(name)) + name + contents[name_end:offset])
        elif not name.startswith(b'phm_'):
            exports.append(contents[start:offset])
    assert offset == len(contents)
    assert len(exports) == count - 27
    return wasm.uleb(len(exports)) + b''.join(exports)


def build():
    candidate = tail.build()
    baseline = (ROOT / 'baselines/previous-v87.wasm').read_bytes()
    assert tail.sha256(candidate) == PINNED_V90
    assert tail.sha256(baseline) == PINNED_V87
    sections = wasm.sections(candidate)
    bodies = wasm.code_bodies(dict(sections)[10])
    v87_bodies = wasm.code_bodies(dict(wasm.sections(baseline))[10])
    bodies[71935 - wasm.DEF_FUNCS] = v87_bodies[71935 - wasm.DEF_FUNCS]

    # Keep both hand-color calls and their scratch allocation. Discard only
    # the old diagnostic result, serial counter, and exported underlay status.
    idx = 5031 - wasm.DEF_FUNCS
    builder = bodies[idx]
    for old, new in (
        ('10 fe b1 04 24 1a 23 1b 41 01 6a 24 1b', '10 fe b1 04 1a'),
        ('10 ff b1 04 24 1c', '10 ff b1 04 1a'),
    ):
        before = bytes.fromhex(old)
        assert builder.count(before) == 1
        builder = builder.replace(before, bytes.fromhex(new))
    bodies[idx] = builder
    return tail.module(
        (sid, player_exports(data) if sid == 7 else tail.code(bodies) if sid == 10 else data)
        for sid, data in sections
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
