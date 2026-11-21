"""Attach verified item corrections to the current Unity rebuild's owned layers."""
import argparse
from pathlib import Path

import patch_native_player_v98 as v98
import patch_native_player_v105 as v105

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'prototype/native_keyed_underlay_v106.wasm'
SELECTED_LEGACY = ROOT / 'prototype/native_underlay_v106.wasm'
BASE_SHA256 = '77710564f08b5e00d1411aba4717925af0d0b88edf9ac82b5fb5394610adc4ed'
BUILDER = v98.BUILDER
wasm = v105.wasm
tail = v105.tail

# Pinned CharacterBuilder fields used by the existing GetPixels calls.
BODY, ARMOR, HELMET, FIREARM, CAPE = 32, 40, 44, 52, 60
# Rebuild locals for the additional private managed Color32[] instances.
CAPE_COPY, ARMOR_COPY, SHADOW_COPY, HELMET_BODY_COPY = 19, 20, 21, 22
NULL = bytes.fromhex('41 00')
ONE = bytes.fromhex('41 01')
APACHE = bytes.fromhex('41 03')


def op(code, immediate):
    return bytes([code]) + wasm.uleb(immediate)


def local(index):
    return op(0x20, index)


def key(field):
    return local(0) + bytes.fromhex('28 02') + wasm.uleb(field)


def clone_if_armed(destination, query):
    # Local 2 holds this lookup's Color32[]; preserve it if cloning fails.
    clone = bytes.fromhex('20 02 41 b4 bd bc 01 28 02 00 10 e4 47')
    return (
        local(2) + b'\x04\x40' + key(FIREARM) + b'\x04\x40' +
        key(FIREARM) + bytes.fromhex('28 02 08 04 40') +
        query + b'\x04\x40' + clone + op(0x22, destination) + b'\x04\x40' +
        local(destination) + op(0x21, 2) + b'\x0b' * 5
    )


def patch_builder(body, helper, armed_body):
    assert body.startswith(bytes.fromhex('03 08 7f 02 7d 06 7f'))
    body = body[:5] + b'\x0a' + body[6:]
    call = op(0x10, helper)
    replace = v98.replace_once

    for field, copy in ((CAPE, CAPE_COPY), (ARMOR, ARMOR_COPY)):
        lookup = key(field) + bytes.fromhex('41 00 20 03 10 f9 0f 21 02')
        body = replace(body, lookup, lookup + clone_if_armed(copy, key(field) + NULL * 4 + call))

    # Only clone the extra Armor lookup when its actual source is the
    # reference-verified Apache shadow. It may otherwise be a glove.
    shadow_lookup = bytes.fromhex('20 07 28 02 00 41 00 20 03 10 f9 0f 21 02')
    capture = bytes.fromhex('20 02 41 d0 01')
    shadow_query = key(ARMOR) + local(2) + NULL * 3 + call
    body = replace(body, shadow_lookup + capture,
                   shadow_lookup + clone_if_armed(SHADOW_COPY, shadow_query) + capture)

    # The verified Helmet templates fill a Human Body pixel. Capture its
    # private array before the original Body append, after the v98 hook.
    append_body = bytes.fromhex('20 05 41 f8 92 be 01 28 02 00 20 02')
    query = (key(HELMET) + NULL + key(BODY) + NULL * 2 + call +
             key(ARMOR) + NULL * 4 + call + APACHE + bytes.fromhex('47 71'))
    body = replace(body, append_body, clone_if_armed(HELMET_BODY_COPY, query) + append_body)

    legacy = bytes.fromhex('20 0e 20 0d 23 19 10 ff b1 04 1a')
    # Even the compatibility pass must match a selected item. Its Apache
    # erase is disabled; only the new pass owns the Apache Armor targets.
    recipes_by_layer = ((CAPE, (1,)), (BODY, (2, 7, 8, 9, 10)),
                        (ARMOR, (3, 4, 5, 6)), (HELMET, (11, 12)))
    recipe_bits = [
        ONE + key(field) + NULL * 4 + call + b'\x74' +
        op(0x41, sum(1 << item for item in recipes)) + b'\x71'
        for field, recipes in recipes_by_layer
    ]
    selected = recipe_bits[0] + b''.join(bits + b'\x72' for bits in recipe_bits[1:])
    repairs = b''.join(
        key(field) + local(copy) + companion + local(14) + local(13) + call + b'\x1a'
        for field, copy, companion in (
            (CAPE, CAPE_COPY, NULL),
            (ARMOR, ARMOR_COPY, local(SHADOW_COPY)),
            (BODY, 16, NULL),
            (HELMET, HELMET_BODY_COPY, key(BODY)),
        )
    )
    body = replace(body, legacy, local(14) + local(13) + selected + legacy[-5:] + repairs)
    # Preserve the existing v99 Body pass and v98 tail mask after the new
    # layer-specific passes. The pin also checks their order.
    assert body.count(local(15) + local(16) + local(13) + op(0x10, armed_body)) == 1
    return body


def build():
    baseline = v105.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    before = dict(sections)
    bodies = wasm.code_bodies(before[10])
    count, first_function = wasm.ul(before[3], 0)
    type_count, first_type = wasm.ul(before[1], 0)
    assert count == len(bodies)
    helper = dict(wasm.sections(HELPER.read_bytes()))
    signature = bytes.fromhex('60 05 7f 7f 7f 7f 7f 01 7f')
    assert helper[1] == b'\x01' + signature
    assert helper[3] == b'\x01\x00'
    memory_import = b'\x01\x03env\x06memory\x02\x00'
    assert helper[2].startswith(memory_import)
    _, end = wasm.ul(helper[2], len(memory_import))
    assert end == len(helper[2])
    assert all(sid not in helper for sid in (5, 8, 9, 11, 12))
    bodies[BUILDER - wasm.DEF_FUNCS] = patch_builder(
        bodies[BUILDER - wasm.DEF_FUNCS], wasm.DEF_FUNCS + count, wasm.DEF_FUNCS + count - 1)
    bodies[wasm.FUNC - wasm.DEF_FUNCS] = wasm.body_from_helper(SELECTED_LEGACY)
    bodies.append(wasm.body_from_helper(HELPER))
    updates = {
        1: wasm.uleb(type_count + 1) + before[1][first_type:] + signature,
        3: wasm.uleb(count + 1) + before[3][first_function:] + wasm.uleb(type_count),
        10: tail.code(bodies),
    }
    return tail.module((sid, updates.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
