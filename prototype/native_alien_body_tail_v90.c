#include <stdint.h>

enum { ATLAS_WIDTH = 576, ATLAS_HEIGHT = 928, TILE_SIZE = 64 };

static inline uint32_t *atlas(uint32_t array) {
    return (uint32_t *)(uintptr_t)(array + 16u);
}

static inline int atlas_array(uint32_t array) {
    return array != 0 &&
        *(const uint32_t *)(uintptr_t)(array + 12u) == ATLAS_WIDTH * ATLAS_HEIGHT;
}

static inline unsigned idle_index(unsigned x, unsigned y) {
    return (ATLAS_HEIGHT - 1u - 64u - y) * ATLAS_WIDTH + x;
}

static inline uint32_t idle_shape(const uint32_t *pixels, int armor) {
    uint32_t hash = 2166136261u;
    for (unsigned y = 0; y < TILE_SIZE; ++y) {
        for (unsigned x = 0; x < TILE_SIZE; ++x) {
            // The existing Alien underlay may already have filled four cells.
            const int filled_underlay = armor && x == 27 && y >= 18 && y <= 21;
            const int opaque = !filled_underlay && (pixels[idle_index(x, y)] >> 24) != 0;
            hash = (hash ^ opaque) * 16777619u;
        }
    }
    return hash;
}

// The builder owns a copy of the selected Body source. Use the original Body
// to verify each tail pixel after the existing corrections have run. Only the
// copy is writable, so a rebuild can restore the original tail after unequipping.
__attribute__((export_name("phm_alien_body_tail")))
int phm_alien_body_tail(uint32_t body_array, uint32_t body_copy, uint32_t armor_array) {
    if (!atlas_array(body_array)) {
        return 0;
    }

    const uint32_t *body = atlas(body_array);
    switch (idle_shape(body, 0)) {
        case 0x47132dd3u: // Lizard #50 and Fire Lizard #86
        case 0xbed8b438u: // Merman #74
        case 0x4647633fu: // Furry #157
        case 0xd4b908d9u: // Werewolf #66
            break;
        default:
            return 0;
    }

    // A null copy and Armor is the builder's read-only eligibility query.
    if (!body_copy && !armor_array) {
        return 1;
    }
    if (body_copy == body_array || body_copy == armor_array ||
        !atlas_array(body_copy) || !atlas_array(armor_array) ||
        idle_shape(atlas(armor_array), 1) != 0x0acbc220u) { // Alien, resources.assets #166
        return 0;
    }

    uint32_t *output = atlas(body_copy);
    for (unsigned y = 14; y <= 23; ++y) {
        for (unsigned x = 22; x < 27; ++x) {
            const unsigned index = idle_index(x, y);
            if ((body[index] >> 24) && output[index] == body[index]) {
                output[index] = 0;
            }
        }
    }
    return 1;
}
