/* Native WebAssembly proof of concept; not linked to the Unity WebGL.wasm runtime.
 * Color32 pixels use top-down 64x64 RGBA in this isolated test.
 * The caller MUST supply verified current item and firearm identities.
 * All firearm pixels in weapon_occlusion stay visually above the patch.
 */
#include <stdint.h>
#define SIDE 64
#define PIXELS (SIDE * SIDE)
#define CAPE 1
#define FIRE_LIZARD 2
#define APACHE 3
#define BOLT 49  /* Unity Resources Texture2D 'Bolt' pathID, not a Unity item enum */
__attribute__((export_name("apply_underlay")))
int apply_underlay(uint8_t* original, const uint8_t* weapon_occlusion, uint8_t* out,
                   int item, int firearm_texture_pathid) {
    // In the actual Unity game, item identity and gun pointer must be independently verified.
    for (int i = 0; i < PIXELS * 4; ++i) out[i] = original[i];
    if (firearm_texture_pathid != BOLT || item < CAPE || item > APACHE) return 0;
    // sample anchor pixels from pre-correction frame; original retains the source throughout
    const int ops[3][5][4] = {
       // x,y, sample_x, sample_y; -1 denotes a true erase, -2 unused
       {{27,17,27,18},{-2,0,0,0},{-2,0,0,0},{-2,0,0,0},{-2,0,0,0}},
       {{27,18,25,20},{26,19,25,20},{27,19,29,19},{26,20,26,21},{27,20,26,21}},
       {{27,17,-1,-1},{-2,0,0,0},{-2,0,0,0},{-2,0,0,0},{-2,0,0,0}}
    };
    int applied = 0;
    for (int k=0; k<5; ++k) {
       const int* op=ops[item-1][k];
       int x=op[0],y=op[1],sx=op[2],sy=op[3];
       if (x == -2) break;
       int d=(y*SIDE+x)*4;
       if (weapon_occlusion[d+3] != 0) continue;
       if (sx == -1) {
           // Erase is not achievable by an ordinary transparent-over operation.
           out[d+0]=out[d+1]=out[d+2]=out[d+3]=0;
       } else {
           int s=(sy*SIDE+sx)*4;
           if (original[s+3] != 255) continue; // fail closed if source unavailable/marker
           for (int c=0; c<4; ++c) out[d+c]=original[s+c];
       }
       ++applied;
    }
    return applied;
}
