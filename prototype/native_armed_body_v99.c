#include <stdint.h>

enum {
    WIDTH = 576, HEIGHT = 928, IDLE_Y = 64, ARRAY_HEADER = 16, STRING_HEADER = 12,
};

__attribute__((always_inline)) static inline int key_equals(
        uint32_t address, const char *name, unsigned length, uint64_t limit) {
    if (address < 4096 ||
        (uint64_t)address + STRING_HEADER + 2 * (length + 1) > limit ||
        *(const uint32_t *)(uintptr_t)(address + 8) <= length) return 0;
    const uint16_t *key = (const uint16_t *)(uintptr_t)(address + STRING_HEADER);
    if (key[length] != '#') return 0;
    for (unsigned i = 0; i < length; ++i)
        if (key[i] != (uint8_t)name[i]) return 0;
    return 1;
}

static inline int atlas_valid(uint32_t address, uint64_t limit) {
    return address >= 4096 && (uint64_t)address + ARRAY_HEADER + WIDTH * HEIGHT * 4 <= limit &&
        *(const uint32_t *)(uintptr_t)(address + 12) == WIDTH * HEIGHT;
}

static inline unsigned idle_at(unsigned x, unsigned y) {
    return (HEIGHT - 1 - IDLE_Y - y) * WIDTH + x;
}

__attribute__((always_inline)) static inline unsigned restore(
        uint32_t *body, const uint32_t *gun, unsigned x, unsigned y, uint32_t color) {
    const unsigned at = idle_at(x, y);
    if (gun[at] >> 24 || body[at] == color) return 0;
    body[at] = color;
    return 1;
}

// Use the exact Body selection and its live swatch. The existing tail hook
// provides an owned Body copy, already attached at the correct layer depth.
__attribute__((export_name("mutts_armed_body")))
int mutts_armed_body(uint32_t body_key, uint32_t body_copy, uint32_t firearm) {
    const uint64_t limit = (uint64_t)__builtin_wasm_memory_size(0) * 65536;
    if (body_copy == firearm || !atlas_valid(body_copy, limit) || !atlas_valid(firearm, limit)) return 0;
    const int furry = key_equals(body_key, "Furry", 5, limit);
    const int merman = key_equals(body_key, "Merman", 6, limit);
    const int werewolf = key_equals(body_key, "Werewolf", 8, limit);
    if (!furry && !merman && !werewolf) return 0;

    uint32_t *body = (uint32_t *)(uintptr_t)(body_copy + ARRAY_HEADER);
    const uint32_t *gun = (const uint32_t *)(uintptr_t)(firearm + ARRAY_HEADER);
    const uint32_t main = body[idle_at(28, 19)];
    const uint32_t shade = merman ? body[idle_at(26, 21)] : body[idle_at(25, 19)];
    if ((main >> 24) != 255 || (shade >> 24) != 255) return 0;

    unsigned repaired = 0;
    // The coordinates and donors are the same as the three original,
    // reference-verified first-idle Body templates.
    if (merman) {
        repaired += restore(body, gun, 27, 19, main);
        repaired += restore(body, gun, 26, 20, main);
        repaired += restore(body, gun, 27, 20, shade);
        repaired += restore(body, gun, 27, 21, main);
    } else {
        if (werewolf) {
            repaired += restore(body, gun, 26, 18, main);
            repaired += restore(body, gun, 26, 20, main);
        }
        repaired += restore(body, gun, 27, 18, main);
        repaired += restore(body, gun, 26, 19, shade);
        repaired += restore(body, gun, 27, 19, shade);
        repaired += restore(body, gun, 27, 20, main);
    }
    return repaired;
}
