Pixel Hero Maker [v.89]
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
source108SelectedButUnavailable=true identify this condition. v89 does NOT
alter the v80 hand routine or guess glove/armor colors. Send paired fresh
sprite exports and PixelHero-v89-IdleAutoHandTrace.json for further study.

WINDOWS
Extract Pixel Hero Maker [v.89].zip into any folder. Run
Pixel Hero Maker [v.89].exe. It opens the offline game in your browser
through a local server. Keep the console launcher running during play.

WEB
Extract Pixel Hero Maker [v.89] (Web).zip into any folder. Serve
index.html over local HTTP if direct file:// loading is restricted.

Default PNG export is SpriteSheet.png; custom export names remain supported.
Only the first idle frame is targeted by the native corrective stage.
Live v89 Unity interaction, Windows GUI operation, and the downloaded ZIP
basenames have not been independently verified in this environment.
