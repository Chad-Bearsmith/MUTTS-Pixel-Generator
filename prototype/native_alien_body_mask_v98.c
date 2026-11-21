/* Use the selected Unity Body and Armor keys, which are resolved before
   GetPixels applies the swatches. Only the private Body copy is writable. */
#include <stdint.h>

enum {
    WIDTH = 576, HEIGHT = 928, IDLE_Y = 64,
    FIRST_X = 22, FIRST_Y = 14, MASK_WIDTH = 5, MASK_ROWS = 10,
    ARRAY_HEADER = 16, STRING_HEADER = 12,
};

static inline int has_key(uint32_t address, uint64_t limit) {
    return address >= 4096 && (uint64_t)address + STRING_HEADER <= limit;
}

__attribute__((always_inline)) static inline int key_equals(
        uint32_t address, const char *name, unsigned length, uint64_t limit) {
    if (!has_key(address, limit) ||
        (uint64_t)address + STRING_HEADER + 2 * (length + 1) > limit) return 0;
    const uint32_t size = *(const uint32_t *)(uintptr_t)(address + 8);
    if (size <= length) return 0;
    const uint16_t *key = (const uint16_t *)(uintptr_t)(address + STRING_HEADER);
    if (key[length] != '#') return 0;
    for (unsigned i = 0; i < length; ++i)
        if (key[i] != (uint8_t)name[i]) return 0;
    return 1;
}

#define KEY_IS(address, name) key_equals(address, name, sizeof(name) - 1, limit)
#define ROW(y, bits) ((uint64_t)(bits) << ((y - FIRST_Y) * MASK_WIDTH))

__attribute__((export_name("mutts_alien_body_mask")))
int mutts_alien_body_mask(uint32_t body_key, uint32_t armor_key, uint32_t body_copy) {
    const uint64_t limit = (uint64_t)__builtin_wasm_memory_size(0) * 65536;
    // The masks were taken from the first idle frame of the original Body
    // textures (sharedassets0 IDs 50, 86, 74, 157, and 66 respectively).
    // Each bit is a tail pixel, starting at x=22. A changed RGB value
    // still belongs to the same tail pixel on this Body layer.
    uint64_t mask;
    if (KEY_IS(body_key, "Lizard") || KEY_IS(body_key, "FireLizard")) {
        mask = ROW(18, 0x10) | ROW(19, 0x18) | ROW(20, 0x1c) |
               ROW(21, 0x1e) | ROW(22, 0x1e);
    } else if (KEY_IS(body_key, "Merman")) {
        mask = ROW(21, 0x18) | ROW(22, 0x1c) | ROW(23, 0x0c);
    } else if (KEY_IS(body_key, "Furry")) {
        mask = ROW(14, 0x06) | ROW(15, 0x0f) | ROW(16, 0x0f) |
               ROW(17, 0x0f) | ROW(18, 0x1f) | ROW(19, 0x1e) | ROW(20, 0x1c);
    } else if (KEY_IS(body_key, "Werewolf")) {
        mask = ROW(15, 0x03) | ROW(16, 0x07) | ROW(17, 0x0f) |
               ROW(18, 0x0f) | ROW(19, 0x0e) | ROW(20, 0x0c);
    } else {
        return 0;
    }

    // Keep the private clone for these Bodies with other Armor choices too.
    // The older equipment underlays can also write into the Body layer.
    if (!body_copy) return 1;
    if (!KEY_IS(armor_key, "Alien")) return 0;
    if (body_copy < 4096 ||
        (uint64_t)body_copy + ARRAY_HEADER + WIDTH * HEIGHT * 4 > limit ||
        *(const uint32_t *)(uintptr_t)(body_copy + 12) != WIDTH * HEIGHT) return 0;

    uint32_t *pixels = (uint32_t *)(uintptr_t)(body_copy + ARRAY_HEADER);
    for (unsigned row = 0; row < MASK_ROWS; ++row) {
        uint32_t *tail = pixels + (HEIGHT - 1 - IDLE_Y - FIRST_Y - row) * WIDTH + FIRST_X;
        for (unsigned x = 0; x < MASK_WIDTH; ++x) {
            if (mask & 1) tail[x] = 0;
            mask >>= 1;
        }
    }
    return 1;
}
