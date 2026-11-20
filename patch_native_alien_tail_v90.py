"""Build the v.90 native tail correction from the pinned v.89 module."""
import argparse
import hashlib
from pathlib import Path

import patch_native_underlay_v89 as v89

ROOT = Path(__file__).resolve().parent
HELPER = ROOT / 'prototype/native_alien_body_tail_v90.wasm'
BASELINE_SHA256 = '7472d295f8b917c1c445973958414c7c2b3a3c6bdc3ed701ef4b9b438cb9016a'
BUILDER = 5031
CLONE_COLOR32_ARRAY = 9188


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def module(sections):
    return b'\0asm\1\0\0\0' + b''.join(
        bytes([section_id]) + v89.uleb(len(contents)) + contents
        for section_id, contents in sections
    )


def code(bodies):
    return v89.uleb(len(bodies)) + b''.join(
        v89.uleb(len(body)) + body for body in bodies
    )


def v89_baseline():
    # Reconstruct the historical module from the preserved v.88 baseline and
    # v.89 helper. This also avoids duplicating the Unity WASM in the repository.
    raw = v89.BASE.read_bytes()
    assert sha256(raw) == v89.BASE_HASH
    sections = v89.sections(raw)
    original = v89.code_bodies(dict(sections)[10])
    original[v89.FUNC - v89.DEF_FUNCS] = v89.body_from_helper()
    baseline = module((sid, code(original) if sid == 10 else data) for sid, data in sections)
    assert sha256(baseline) == BASELINE_SHA256
    return baseline


def builder_with_tail_hook(body, helper_index):
    # Offsets are within the SHA-pinned v.89 CharacterBuilder.Rebuild body.
    # The Body GetPixels result (site 103) can alias Unity's texture cache.
    # Thread the original Body (15), its owned copy (16), and Armor (17)
    # through this rebuild only. Apply after 71935 and before the texture is
    # produced so the existing hand and underlay recognizers see their inputs.
    body_stored = 0x5EB
    armor_stored = 0x82D
    underlay_stored = 0x15AE
    get_pixels_and_store = bytes.fromhex('10 f9 0f 21 02')
    assert body[body_stored - 5:body_stored] == get_pixels_and_store
    assert body[armor_stored - 5:armor_stored] == get_pixels_and_store
    assert body[underlay_stored - 6:underlay_stored] == bytes.fromhex('10 ff b1 04 24 1c')
    assert body[:7] == bytes.fromhex('03 08 7f 02 7d 02 7f')
    call_tail = b'\x10' + v89.uleb(helper_index)
    clone_body = (
        bytes.fromhex('20 00 28 02 28 04 40') +  # if (this.armor)
        bytes.fromhex('20 02 41 00 41 00') + call_tail + bytes.fromhex('04 40') +
        bytes.fromhex('20 02 21 0f 20 02 41 b4 bd bc 01 28 02 00 10') +
        v89.uleb(CLONE_COLOR32_ARRAY) +
        bytes.fromhex('22 10 04 40 20 10 21 02 0b 0b 0b')
    )
    capture_armor = bytes.fromhex('20 02 21 11')
    apply = bytes.fromhex('20 10 45 20 11 45 72 45 04 40 20 0f 20 10 20 11') + call_tail + b'\x1a\x0b'
    return (
        body[:5] + b'\x05' + body[6:body_stored] + clone_body +
        body[body_stored:armor_stored] + capture_armor +
        body[armor_stored:underlay_stored] + apply + body[underlay_stored:]
    )


def build():
    helper = dict(v89.sections(HELPER.read_bytes()))
    assert helper[1] == b'\x01\x60\x03\x7f\x7f\x7f\x01\x7f'
    memory_import = b'\x01\x03env\x06memory\x02\x00'
    assert helper[2].startswith(memory_import)
    _, end = v89.ul(helper[2], len(memory_import))
    assert end == len(helper[2])
    assert helper[3] == b'\x01\x00'
    assert all(sid not in helper for sid in (8, 9, 11, 12))
    tail_body, = v89.code_bodies(helper[10])
    sections = v89.sections(v89_baseline())
    original = dict(sections)
    types = original[3]
    count, start = v89.ul(types, 0)
    signature = 1  # Existing (i32, i32, i32) -> i32 type.
    _, first_type = v89.ul(original[1], 0)
    assert original[1][first_type + 6:].startswith(helper[1][1:])
    builder = BUILDER - v89.DEF_FUNCS
    bodies = v89.code_bodies(original[10])
    assert len(bodies) == count
    bodies[builder] = builder_with_tail_hook(bodies[builder], v89.DEF_FUNCS + count)
    bodies.append(tail_body)
    changed = {
        3: v89.uleb(count + 1) + types[start:] + v89.uleb(signature),
        10: code(bodies),
    }
    return module((sid, changed.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game/Build/WebGL.wasm')
    args = parser.parse_args()
    result = build()
    args.output.write_bytes(result)
    print('v.90 WebAssembly SHA-256', sha256(result))
