# Art direction

The rules every visual change (and any future authored asset) should follow.

## The look

**Dhaka after hours, as a travel poster.** Golden hour, dusk, night and dawn only. Each district is a few flat colours: a sky gradient, one or two building hues and one accent. The city steps back in layers that fade into the sky.

1. **Flat colour, no grime.** Surfaces are clean fills. No noise, stains, blotches or grain. Detail comes from shape (windows, ledges, awnings), not texture. `GRIME` in `src/world/paint.js` switches the old weathering back on, but leave it off.
2. **One palette per district.** `palette` in `src/world/stages.js` (two hues) tints every building. Facade textures are painted pale and muted, so the palette supplies the colour. Don't add saturated wall colours to a facade; add a hue to the palette instead.
3. **Strong aerial perspective.** Fog is about three times the old density. Near objects are saturated and distant ones melt into the sky colour. This creates the depth, so don't use contrast or outlines for it.
4. **Restraint.** A decoration is a set piece, not wallpaper. Alpana covers about one cell in five, billboards are rare, and wires and fairy lights are sparse even in Old Dhaka. If you add something, take something away.
5. **Clean image.** No CRT scanlines (off by default; still in settings), film grain or chromatic aberration. Light vignette, low bloom. Light pools are wide and soft and never blow out.
6. **One style for people and props.** No flat cartoon cutouts beside 3D geometry (the festival masks are out of the street life).
7. **Toon shapes, inked.** Buildings are solid masses with lit windows (no frames, grilles or clutter), lit in two flat bands, with ink outlines from the depth buffer. Trees are a dozen big lobes; people are one chunky silhouette with a big head. Every sprite gets the same dark ink rim. `FLAT` in `src/world/paint.js` switches all of this.
8. **Graphic signage.** Shop signs, billboards and rickshaw panels are a flat field, one big shape and one line of lettering. No faces, gradients, taglines or phone numbers. The road alpana is one six-petal flower in a single colour.
9. **Our own lettering.** In-world Bangla uses Atma (display) and Mina (plates, small print). Don't use Galada, Hind Siliguri, Tiro Bangla, Anek Bangla or Baloo Da 2 for in-world text: they are the generic choices.

## What it is not

Not daylight realism, grey haze, bunting on everything, or a dense tangle of wires and signs. That is the generic "low-poly Dhaka" look.
