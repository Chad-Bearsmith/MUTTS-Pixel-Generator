/* Some armed poses append a copy of the current firearm to the composite
   after recoloring its hand markers. Find that copy and apply the builder's
   verified arm color at the markers it will render. */
#include <stdint.h>

enum {
    WIDTH = 576, HEIGHT = 928, TILE = 64, IDLE_Y = 64,
    REFERENCE = (HEIGHT - 1 - IDLE_Y - 19) * WIDTH + 27,
    OVERLAY_ABSENT = 411668, ARM_FRESH = 446608, OVERLAY_FRESH = 446612,
    ARM_PIXELS = 2584832, OVERLAY_PIXELS = 4722944,
    FIREARM_NOT_UNIQUE = 6, MAX_LAYERS = 32, ARRAY_HEADER = 16,
};

static inline uint32_t read_word(uint32_t address) {
    return *(const uint32_t *)(uintptr_t)address;
}

static inline int valid_array(uint32_t address, uint32_t length, uint64_t limit) {
    return address >= 4096 && (uint64_t)address + ARRAY_HEADER + length * 4 <= limit &&
           read_word(address + 12) == length;
}

static inline int idle_row(int y) {
    return (HEIGHT - 1 - IDLE_Y - y) * WIDTH;
}

static int matching_firearm(const uint32_t *source, const uint32_t *candidate) {
    for (int y = 0; y < TILE; ++y) {
        const int offset = idle_row(y);
        for (int x = 0; x < TILE; ++x) {
            const uint32_t a = source[offset + x], b = candidate[offset + x];
            if (a != b && ((a >> 24) != 254 || (b >> 24) != 254)) return 0;
        }
    }
    return 1;
}

__attribute__((export_name("mutts_hand_fallback")))
int mutts_hand_fallback(uint32_t previous, uint32_t firearm, uint32_t scratch, uint32_t layers) {
    if (previous != FIREARM_NOT_UNIQUE) return 0;
    const uint64_t limit = (uint64_t)__builtin_wasm_memory_size(0) * 65536;
    if (!valid_array(firearm, WIDTH * HEIGHT, limit) ||
        scratch < 4096 || layers < 4096 || (uint64_t)layers + ARRAY_HEADER > limit ||
        (uint64_t)scratch + OVERLAY_PIXELS + (REFERENCE + 1) * 4 > limit ||
        read_word(scratch + ARM_FRESH) != 1) return 0;
    const uint32_t count = read_word(layers + 12);
    if (count < 1 || count > MAX_LAYERS || !valid_array(layers, count, limit)) return 0;

    uint32_t color = read_word(scratch + ARM_PIXELS + REFERENCE * 4);
    if (read_word(scratch + OVERLAY_FRESH) == 1) {
        const uint32_t overlay = read_word(scratch + OVERLAY_PIXELS + REFERENCE * 4);
        if (overlay >> 24) color = overlay;
    } else if (read_word(scratch + OVERLAY_ABSENT) != 1) {
        return 0;
    }
    if ((color >> 24) != 255) return 0;

    const uint32_t *source = (const uint32_t *)(uintptr_t)(firearm + ARRAY_HEADER);
    unsigned markers = 0;
    for (int y = 0; y < TILE; ++y) {
        const int offset = idle_row(y);
        for (int x = 0; x < TILE; ++x) markers += (source[offset + x] >> 24) == 254;
    }
    if (markers != 7 && markers != 9) return 0;

    uint32_t *target = 0;
    for (uint32_t i = 0; i < count; ++i) {
        const uint32_t address = read_word(layers + ARRAY_HEADER + i * 4);
        if (!valid_array(address, WIDTH * HEIGHT, limit)) return 0;
        uint32_t *candidate = (uint32_t *)(uintptr_t)(address + ARRAY_HEADER);
        /* The hand colors may differ. The rest of the idle frame must match
           the current firearm byte for byte, at the same coordinates. */
        if (!matching_firearm(source, candidate)) continue;
        if (target && target != candidate) return 0;
        target = candidate;
    }
    if (!target) return 0;

    const uint32_t tinted = (color & UINT32_C(0x00ffffff)) | UINT32_C(0xfe000000);
    for (int y = 0; y < TILE; ++y) {
        const int offset = idle_row(y);
        for (int x = 0; x < TILE; ++x) {
            if ((target[offset + x] >> 24) == 254) target[offset + x] = tinted;
        }
    }
    return 1;
}
