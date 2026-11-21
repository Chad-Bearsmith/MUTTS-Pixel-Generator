MUTTS Pixel Generator [v.96] player build. The native builder applies Alien
Armor's first-idle tail correction to a private copy of the Body layer and
uses the v.89 source-aware firearm underlay. The armed hand lookup now
recognizes a missing overlay slot and preserves genuine glove swatches.
The guarded Apache erase preserves the Small Backpack's original pixel.
The idle preview draws the combined sprite in Unity's WebGL canvas using
the same idle tile as the PNG export.
The default Human's visible bounds define a fixed preview anchor on the shadow.
The native Randomize button inherits Export's styling and applies items and
swatches through Unity's own controls in one editor rebuild.
See docs/BUILD_AND_TEST.md for the pinned rebuild and test commands.
