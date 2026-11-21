"""Expose Unity UI operations and route the cloned Randomize button's press."""
import argparse
from pathlib import Path

import patch_native_player_v95 as v95

wasm = v95.wasm
tail = v95.tail
BASE_SHA256 = '5f0fba8a7a6f5b6aaa49334e4d5179ceedec88a92ee7da324d30e5e860ab402d'
BUTTON_PRESS = 17081
UNITY_UI = {
    'mutts_transform': 731,       # Component.transform
    'mutts_parent': 1165,         # Transform.parent
    'mutts_child': 3307,          # Transform.GetChild
    'mutts_name': 954,            # UnityEngine.Object.name
    'mutts_game_object': 770,     # Component.gameObject
    'mutts_instantiate': 22503,   # Object.Instantiate(Object, Transform, bool)
    'mutts_component': 7248,     # GameObject.GetComponent(Type)
    'mutts_type': 13082,          # System.Object.GetType
    'mutts_caption': 4230,        # Dropdown.captionText
    'mutts_get_text': 4226,       # Text.text
    'mutts_set_text': 71472,      # Text.text setter
    'mutts_alloc_string': 52268,  # String.FastAllocateString
    'mutts_get_position': 1321,   # RectTransform.anchoredPosition getter
    'mutts_set_position': 1740,   # RectTransform.anchoredPosition setter
    'mutts_submit': 71391,        # Button.OnSubmit
    'mutts_event_system': 1721,   # EventSystem.current
    'mutts_selected': 765,        # EventSystem.currentSelectedGameObject
    'mutts_set_selected': 4799,   # EventSystem.SetSelectedGameObject(GameObject)
}


def build():
    baseline = v95.build()
    assert tail.sha256(baseline) == BASE_SHA256
    sections = wasm.sections(baseline)
    original = dict(sections)
    bodies = wasm.code_bodies(original[10])

    globals_count, start = wasm.ul(original[6], 0)
    button_slot = wasm.uleb(globals_count)
    pending_slot = wasm.uleb(globals_count + 1)
    press = BUTTON_PRESS - wasm.DEF_FUNCS
    # Insert after Unity's IsActive() and IsInteractable() branches and before
    # onClick.Invoke(). The cloned Export button signals a roll instead of Save.
    invoke = bytes.fromhex('41 f8 93 be 01 28 02 00 20 00 41 00 10 93 19')
    assert bodies[press].count(invoke) == 1
    signal = (
        b'\x20\x00\x23' + button_slot + b'\x46\x04\x40' +
        b'\x23' + pending_slot + b'\x41\x01\x6a\x24' + pending_slot +
        b'\x0f\x0b'
    )
    bodies[press] = bodies[press].replace(invoke, signal + invoke)
    globals_section = (
        wasm.uleb(globals_count + 2) + original[6][start:] + b'\x7f\x01\x41\x00\x0b' * 2
    )
    added = [(name, 0, index) for name, index in UNITY_UI.items()] + [
        ('mutts_random_button', 3, globals_count),
        ('mutts_roll_pending', 3, globals_count + 1),
    ]
    exports_count, start = wasm.ul(original[7], 0)
    exports = bytearray(wasm.uleb(exports_count + len(added)) + original[7][start:])
    for name, kind, index in added:
        label = name.encode('ascii')
        exports.extend(wasm.uleb(len(label)) + label + bytes([kind]) + wasm.uleb(index))
    updated = {6: globals_section, 7: bytes(exports), 10: tail.code(bodies)}
    return tail.module((sid, updated.get(sid, data)) for sid, data in sections)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=v95.ROOT / 'game/Build/WebGL.wasm')
    output = parser.parse_args().output
    player = build()
    output.write_bytes(player)
    print('Player WebAssembly SHA-256', tail.sha256(player))
