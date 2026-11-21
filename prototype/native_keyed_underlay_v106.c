/* First-idle corrections on the current rebuild's private item arrays.
   Keys come from CharacterBuilder.GetPixels. Layer positions are kept intact. */
#include <stdint.h>

typedef uint32_t u32;
enum {
    WIDTH = 576, HEIGHT = 928, ARRAY_HEADER = 16, MAX_LAYERS = 24,
    CAPE = 1, FIRE_LIZARD = 2, APACHE = 3, ALIEN = 4, ANGEL = 5,
    DRACULA = 6, FURRY = 7, LIZARD = 8, MERMAN = 9, WEREWOLF = 10,
    HELLSING = 11, SNOW_RIDER = 12,
};

__attribute__((always_inline)) static inline int in_memory(u32 address, u32 size, uint64_t limit) {
    return address >= 4096 && (uint64_t)address + size <= limit;
}

__attribute__((always_inline)) static inline u32 length(u32 address) {
    return *(const u32 *)(uintptr_t)(address + 12);
}

__attribute__((always_inline)) static inline int atlas_valid(u32 address, uint64_t limit) {
    return in_memory(address, ARRAY_HEADER + WIDTH * HEIGHT * 4, limit) &&
           length(address) == WIDTH * HEIGHT;
}

__attribute__((always_inline)) static inline u32 *pixels(u32 address) {
    return (u32 *)(uintptr_t)(address + ARRAY_HEADER);
}

__attribute__((always_inline)) static inline unsigned idle_at(unsigned x, unsigned y) {
    return (HEIGHT - 65 - y) * WIDTH + x;
}

__attribute__((always_inline)) static inline int key_equals(
        u32 address, const char *name, unsigned count, uint64_t limit) {
    if (!in_memory(address, 12 + 2 * (count + 1), limit) ||
        *(const u32 *)(uintptr_t)(address + 8) <= count) return 0;
    const uint16_t *key = (const uint16_t *)(uintptr_t)(address + 12);
    if (key[count] != '#') return 0;
    for (unsigned i = 0; i < count; ++i)
        if (key[i] != (uint8_t)name[i]) return 0;
    return 1;
}

__attribute__((always_inline)) static inline unsigned recipe_for(u32 key, uint64_t limit) {
#define KEY_IS(name) key_equals(key, name, sizeof(name) - 1, limit)
    if (KEY_IS("Cape")) return CAPE;
    if (KEY_IS("FireLizard")) return FIRE_LIZARD;
    if (KEY_IS("Apache")) return APACHE;
    if (KEY_IS("Alien")) return ALIEN;
    if (KEY_IS("Angel")) return ANGEL;
    if (KEY_IS("Dracula")) return DRACULA;
    if (KEY_IS("Furry")) return FURRY;
    if (KEY_IS("Lizard")) return LIZARD;
    if (KEY_IS("Merman")) return MERMAN;
    if (KEY_IS("Werewolf")) return WEREWOLF;
    if (KEY_IS("Hellsing")) return HELLSING;
    if (KEY_IS("SnowRider")) return SNOW_RIDER;
#undef KEY_IS
    return 0;
}

__attribute__((always_inline)) static inline u32 alpha_hash(const u32 *atlas, int binary_shape) {
    u32 hash = 2166136261u;
    for (unsigned y = 0; y < 64; ++y) {
        for (unsigned x = 0; x < 64; ++x) {
            const u32 alpha = atlas[idle_at(x, y)] >> 24;
            hash = (hash ^ (binary_shape ? alpha != 0 : alpha)) * 16777619u;
        }
    }
    return hash;
}

__attribute__((always_inline)) static inline int supported_firearm(u32 hash) {
    return hash == 0x3dbe5bbdu || hash == 0xb739dd6bu || hash == 0xb53b9051u ||
           hash == 0xbb38ddadu || hash == 0x6482d900u || hash == 0x34316c13u ||
           hash == 0x65ebb6c2u || hash == 0xeac21292u || hash == 0xb92bc587u ||
           hash == 0xb0995dc5u || hash == 0x0b9ac9b1u || hash == 0x026236c2u ||
           hash == 0x55389cbcu || hash == 0xd19e7a37u || hash == 0x8b4dc278u ||
           hash == 0x4d812c43u || hash == 0x3f01d93bu || hash == 0x379133d2u ||
           hash == 0x1e1f366cu || hash == 0x5fe65d47u || hash == 0x3ac28527u ||
           hash == 0x894c19cbu || hash == 0x58f03ba8u || hash == 0x0175df7au ||
           hash == 0xcc087534u;
}

__attribute__((always_inline)) static inline int matching_firearm(const u32 *source, const u32 *candidate) {
    if (source == candidate) return 1;
    /* The hand pass can recolor alpha-254 markers in the rendered copy. */
    for (unsigned y = 0; y < 64; ++y) {
        for (unsigned x = 0; x < 64; ++x) {
            const unsigned at = idle_at(x, y);
            const u32 a = source[at], b = candidate[at];
            if (a != b && ((a >> 24) != 254 || (b >> 24) != 254)) return 0;
        }
    }
    return 1;
}

__attribute__((always_inline)) static inline int opaque(u32 color) { return (color >> 24) == 255; }

__attribute__((always_inline)) static inline void set_pixel(u32 *target, const u32 *gun, unsigned x, unsigned y, u32 color) {
    const unsigned at = idle_at(x, y);
    if ((gun[at] >> 24) == 0) target[at] = color;
}

/* With no list, query a key before cloning. For Apache's optional second
   layer, also require the verified shadow silhouette at the Armor lookup. */
__attribute__((export_name("mutts_keyed_underlay")))
int mutts_keyed_underlay(u32 key, u32 target, u32 companion, u32 list, u32 firearm) {
    const uint64_t limit = (uint64_t)__builtin_wasm_memory_size(0) * 65536;
    const unsigned recipe = recipe_for(key, limit);
    if (!recipe) return 0;
    if (!list) {
        if (companion) return (recipe == HELLSING || recipe == SNOW_RIDER) &&
                              key_equals(companion, "Human", 5, limit);
        if (!target) return recipe;
        return recipe == APACHE && atlas_valid(target, limit) &&
               alpha_hash(pixels(target), 1) == 0x7e3fff48u;
    }
    // The dedicated v99 pass already owns these Body recipes.
    if (recipe == FURRY || recipe == MERMAN || recipe == WEREWOLF) return 0;

    if (!atlas_valid(target, limit) || !atlas_valid(firearm, limit) ||
        !in_memory(list, ARRAY_HEADER, limit)) return 0;
    const u32 count = length(list);
    if (count < 2 || count > MAX_LAYERS || !in_memory(list, ARRAY_HEADER + 4 * count, limit)) return 0;
    const u32 *slots = pixels(list);
    if (target == firearm) return 0;
    const u32 *source = pixels(firearm);
    const u32 *gun = 0;
    unsigned owner_count = 0, companion_count = 0;
    for (u32 i = 0; i < count; ++i) {
        if (!atlas_valid(slots[i], limit)) return 0;
        const u32 *candidate = pixels(slots[i]);
        if (matching_firearm(source, candidate)) {
            if (gun || slots[i] == target || slots[i] == companion) return 0;
            gun = candidate;
        }
        owner_count += slots[i] == target;
        companion_count += slots[i] == companion;
    }
    if (owner_count != 1 || !gun || !supported_firearm(alpha_hash(gun, 0))) return 0;
    if ((recipe == HELLSING || recipe == SNOW_RIDER) &&
        (!key_equals(companion, "Human", 5, limit))) return 0;
    u32 *item = pixels(target);
#define AT(x, y) item[idle_at(x, y)]
#define WRITE(x, y, value) set_pixel(item, gun, x, y, value)

    if (recipe == APACHE) {
        WRITE(27, 17, 0);
        if (companion_count == 1 && companion != target &&
            alpha_hash(pixels(companion), 1) == 0x7e3fff48u)
            set_pixel(pixels(companion), gun, 27, 17, 0);
    } else if (recipe == ANGEL) {
        const u32 color = AT(25, 19);
        if (!opaque(color)) return 0;
        WRITE(27, 17, color);
        WRITE(26, 18, color);
        WRITE(27, 18, color);
        WRITE(26, 19, color);
        WRITE(27, 19, color);
        WRITE(26, 20, color);
        WRITE(27, 20, color);
    } else if (recipe == ALIEN) {
        const u32 main = AT(28, 19), shade = AT(26, 19);
        if (!opaque(main) || !opaque(shade)) return 0;
        WRITE(27, 18, main);
        WRITE(27, 19, shade);
        WRITE(27, 20, shade);
        WRITE(27, 21, main);
    } else if (recipe == DRACULA) {
        const u32 main = AT(28, 19), shade = AT(27, 22);
        const u32 highlight = item[(HEIGHT - 1 - 338) * WIDTH + 29];
        if (!opaque(main) || !opaque(shade)) return 0;
        WRITE(26, 14, main);
        WRITE(37, 14, main);
        WRITE(25, 15, main);
        if (opaque(highlight)) WRITE(26, 15, highlight);
        WRITE(37, 15, shade);
        WRITE(38, 15, main);
        WRITE(25, 16, main);
        WRITE(26, 16, shade);
        WRITE(27, 16, shade);
        WRITE(37, 16, shade);
        WRITE(38, 16, main);
        WRITE(27, 17, main);
        for (unsigned y = 18; y <= 21; ++y) WRITE(27, y, shade);
    } else if (recipe == FIRE_LIZARD || recipe == LIZARD) {
        const u32 main = AT(25, 20), shade = AT(29, 19);
        if (!opaque(main) || !opaque(shade)) return 0;
        WRITE(27, 18, main);
        WRITE(26, 19, main);
        WRITE(27, 19, shade);
        WRITE(26, 20, shade);
        WRITE(27, 20, shade);
    } else {
        const u32 color = recipe == CAPE ? AT(27, 19) : AT(28, 19);
        if (!opaque(color)) return 0;
        /* Helmet templates use a Human Body donor. Never replace an existing
           body pixel for these fill-only templates. */
        if (recipe == CAPE || (AT(27, 17) >> 24) == 0) WRITE(27, 17, color);
    }
#undef AT
#undef WRITE
    return (int)recipe;
}
