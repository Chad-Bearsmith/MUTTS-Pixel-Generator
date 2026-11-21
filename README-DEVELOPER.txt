MUTTS Pixel Generator [v.98] player build. The native builder selects the
first-idle tail mask from the current Body item when Alien Armor is selected.
It applies the mask to a private copy of the Body layer after the v.89
source-aware firearm underlay. The armed hand fallback reads
the current arm or glove swatch even when the composite layer lookup fails
to find the firearm uniquely.
The guarded Apache erase preserves the Small Backpack's original pixel.
The idle preview draws the combined sprite in Unity's WebGL canvas using
the same idle tile as the PNG export.
The default Human's visible bounds define a fixed preview anchor on the shadow.
The native Randomize button inherits Export's styling and applies items and
swatches through Unity's own controls in one editor rebuild.
See docs/BUILD_AND_TEST.md for the pinned rebuild and test commands.
