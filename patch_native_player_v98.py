"""Select the Alien Body tail mask using the pinned Unity builder's item keys."""
import argparse
from pathlib import Path

import patch_native_player_v97 as v97

ROOT = Path(__file__).resolve().parent
HELPER = ROOT / 'prototype/native_alien_body_mask_v98.wasm'
BASE_SHA256 = 'd8d9a19262b6ec19492224001bff792c9fcfd72a55b8fa9e29e3a78dc19f3779'
wasm = v97.wasm
tail = v97.tail
BUILDER = 5031
TAIL = 71936


def replace_once(body, old, new):
    assert body.count(old) == 1
    return body.replace(old, new)


def builder_with_item_keys(body):
    call = b'\x10' + wasm.uleb(TAIL)
    # CharacterBuilder already holds the exact GetPixels keys for the Body
    # (+32) and Armor (+40). Save those keys in the tail hook's existing
    # locals 15 and 17. Keep the owned Body copy for the older underlays too.
    old_query = bytes.fromhex('20 00 28 02 28 04 40 20 02 41 00 41 00') + call
    new_query = bytes.fromhex('20 00 28 02 28 22 11 45 20 02 45 72 45 04 40 '
                              '20 00 28 02 20 22 0f 20 11 41 00') + call
    body = replace_once(body, old_query, new_query)
    clone = bytes.fromhex('04 40 20 02 21 0f 20 02 41 b4 bd bc 01 28 02 00 10 e4 47')
    body = replace_once(body, clone, clone[:2] + clone[6:])
    # The Armor pixels still flow into the compositor through the original
    # local 2. The tail hook no longer needs to capture an Armor array.
    armor = bytes.fromhex('20 00 28 02 28 41 00 20 03 10 f9 0f 21 02')
    body = replace_once(body, armor + bytes.fromhex('20 02 21 11'), armor)
    # Apply after the existing hand and item underlays. Only the owned Body
    # copy (local 16) is passed as a writable atlas.
    old_apply = bytes.fromhex('20 10 45 20 11 45 72 45 04 40 20 0f 20 10 20 11') + call
    new_apply = bytes.fromhex('20 10 04 40 20 0f 20 11 20 10') + call
    return replace_once(body, old_apply, new_apply)


def build():
    baseline = v97.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    bodies = wasm.code_bodies(dict(sections)[10])
    helper = dict(wasm.sections(HELPER.read_bytes()))
    assert helper[1] == b'\x01\x60\x03\x7f\x7f\x7f\x01\x7f'
    memory_import = b'\x01\x03env\x06memory\x02\x00'
    assert helper[2].startswith(memory_import)
    _, end = wasm.ul(helper[2], len(memory_import))
    assert end == len(helper[2])
    assert helper[3] == b'\x01\x00'
    assert all(sid not in helper for sid in (8, 9, 11, 12))
    builder = BUILDER - wasm.DEF_FUNCS
    bodies[builder] = builder_with_item_keys(bodies[builder])
    bodies[TAIL - wasm.DEF_FUNCS] = wasm.body_from_helper(HELPER)
    return tail.module((sid, tail.code(bodies) if sid == 10 else data) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
