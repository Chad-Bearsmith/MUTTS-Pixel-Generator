Pixel Hero Maker [v.90] — development candidate

Alien Armor suppresses verified Body tail pixels in the first idle tile.
This is applied before the native layers combine, including with Firearm set
to Empty. Supported Body selections are Fire Lizard, Lizard, Merman, Furry,
and Werewolf. Live and fixture coverage is recorded in the v.90 changelog.
=======================
EXPERIMENTAL GEOMETRY FIX — NOT A CONFIRMED GLOBAL REPAIR

The four item examples newly supplied after v88 show Apache Armor, Alien
Armor, Dracula Armor, and Furry Body item data present in the native builder,
but omitted companion source arrays prevent the existing correction.

v89 now recognizes these four independently unique primary source alpha masks
and applies the same tested item corrections to the selected item's own input
layer when the Bolt or another recognized firearm leaves the target exposed.
Other items, especially those with shared source silhouettes, remain guarded.

TEST THESE COMBINATIONS
Recreate the four supplied v88 examples. Export SpriteSheet.png and compare
the restored item geometry to the intended appearance. The native trace
should show source-layer codes 8003 Apache, 8004 Alien, 8006 Dracula, or
8007 Furry with Bolt. These still need live Unity validation.

IMPORTANT — HAND-COLOR ISSUE STILL PRESENT
Certain Armor + Cape/Back selections can still cause the firearm hands to
inherit the wrong Cape/Back color. Native hand status 2 and
source108SelectedButUnavailable=true identify this condition. The v80
hand-color routine is still in use. Send paired fresh
sprite exports and PixelHero-v90-IdleAutoHandTrace.json for further study.

RUN THE DEVELOPMENT CHECKOUT
Serve the game directory over local HTTP and open index.html.

Default PNG export is SpriteSheet.png. Custom export names remain supported.
The native corrective stage targets the first idle frame. Windows GUI operation
and downloaded release ZIP filenames have not been tested for this candidate.
