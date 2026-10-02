# Art Director Review, Round 1 (blind)

Frames: 1280x720. Coordinates are (x,y) in frame pixels. I judged pixels only. The only document I read was the round-0 review, for the comparison table.

## Bottom line

**All 11 frames: IMITATION, 93-99% confidence.** Round 1 is a real step up in two areas. The **environment** now has balconies, AC units, Arabic signage, overhead wires, awnings and a believable sky. The **HUD** now speaks something close to the MW2019 language. The hero street, if you crop out the gun, could pass as a mid-2010s CoD map at a glance.

The **viewmodel is still the frame-killer**, and it now fails in a new way. It **goes pitch-black whenever the camera stands in shadow**. I measured the mean luma of the gun region (640-1000, 480-640): about 4 in interior, 5 in sunset, 10 in combat, 15 in impacts and 20 in night, against 56-67 in the sunlit frames. In 5 of 11 frames the rifle is a black cardboard cutout. Where it is lit, it is matte grey plastic with LEGO-brick rail teeth, a dead grey lens and a **checkerboard dither/stipple pattern on every surface**, which also appeared in round 0 as speckle. The plank arm is gone, and that is the round's best single win. It has been replaced by a padded, fingerless mitten block.

There is also a new outright bug in **ADS**: an opaque dark square quad renders behind the red dot.

Average score: **3.1 / 10** (round 0: 2.4 as published, 2.5 from its per-frame scores).

---

## 1. hero.png (daytime street, hip-fire)

**Blind verdict:** IMITATION, 93%. The environment alone would have made me hesitate for a second. The gun ended that.

**Side-by-side vs mw2019-mp-tdm.png:** MW2019 wins by a wide margin, about 5 points. The MW2019 frame has filthy, specific surfaces: water-stained walls, a wet floor with reflections, cones and garbage. Its operators have plate-carrier silhouettes. Its viewmodel has a red sleeve, a worn receiver and real specular response. The candidate's street now has comparable *layout* density (wires, balconies, AC unit at (960,0)-(1010,50), signage at (1000,170)-(1110,240)), but every surface is still clean and evenly lit. Against mw3-2011-paris-street, the candidate's environment is roughly at parity, but MW3's gun and characters are still years ahead.

**Score:** 4/10

**Tells, most damaging first**
1. **Rifle material and geometry** at (730,440)-(1100,720). The receiver is a uniform matte grey slab. The top rail at (720,460)-(1080,720) is a row of oversized black box teeth with no bevels, like a LEGO brick. There is no anodized sheen, edge wear or roughness breakup.
2. **Dither/stipple** across the whole viewmodel. Zoomed 2x, a regular checkerboard pattern runs across the glove at (600,430)-(750,700), the scope bell and the receiver. It reads as broken alpha-to-coverage or a noisy shading pass, and it shows through even at 1x as a gritty, crawling surface.
3. **Scope** at (790,350)-(1000,500). It is a clean tube with a flat grey disc for glass. There is no coating tint, no environment reflection and no inner tunnel darkening, and the knurling at (800,400)-(860,470) is a pasted dot texture.
4. **Left hand** at (600,425)-(750,700). It is a padded mitten with two raised rectangles on the back and no readable fingers wrapping the handguard. The scale is enormous, close to the size of the scope. A wrist watch at (590,660)-(680,720) is a nice idea but reads as a black disc.
5. **Right hand** is missing, or it is the black lump hidden under the ammo HUD at (1140,640)-(1280,720).
6. **Surfaces.** The Jersey barriers at (0,470)-(320,700) and (460,455)-(660,590) are still clean extrusions with no chips or base grime. The sand at (300,470)-(800,720) has dot-speckle noise but no tracks or footprints. The "spill" decal at (330,480)-(470,500) is a flat white blob.
7. **Foliage** at (1140,460)-(1260,560) is still a scatter of loose leaf cards, and they float off the planter.

**Top 3 fixes**
- Rebuild the rifle surface: dark anodized receiver with a satin sheen, worn bright edges on the rail teeth and the scope rim, bevelled rail slots, and a coated lens that mirrors the sky.
- Kill the checkerboard dither on all viewmodel pixels. The surfaces should read as solid and clean at 1x.
- Shrink the left hand and replace the mitten with a glove whose four fingers visibly curl over the handguard and whose thumb runs along the side. Add a sleeve cuff at the wrist.

---

## 2. interior.png (looking out of a room)

**Blind verdict:** IMITATION, 98%.

**Side-by-side vs mw2019-mp-tdm.png** (left half, under the overhang): MW2019 wins by about 7 points. In MW2019 the shaded area still shows the door, sign, pipes and floor puddles, with soft bounce and exposure adaptation. In the candidate the shaded areas are mush and the gun is a black hole.

**Score:** 2/10

**Tells, most damaging first**
1. **Black viewmodel.** The rifle at (600,370)-(1280,720) is a pure black silhouette, mean luma about 4. No first-person shooter ships a viewmodel like this. MW2019 lights its viewmodel separately so it always reads.
2. **Black slab** on the left at (0,280)-(130,560). It is still there from round 0: an unlit, shapeless dark mass.
3. **Wall.** The terracotta wall at (150,0)-(1280,440) now has peeling-stain decals, which is better than round 0, but it is still one flat orange plane. It has no AO in the corners, no plaster relief, and the stains are evenly sprinkled instead of gathering at edges and the floor line.
4. **Exposure.** The exterior through the opening at (455,190)-(940,420) is barely brighter than the interior wall. There is still no sun bounce spilling across the floor.
5. **Grey poles** at (330,40)-(345,700) and (545,60)-(555,720) are untextured lines that cut the composition in thirds.
6. **Floor** at (0,560)-(600,720) is a blue-grey void with a couple of paper sprites.

**Top 3 fixes**
- Give the viewmodel its own fill so the gun reads as dark metal at roughly 15-25% luminance, never black.
- Blow out the exterior two stops above the interior and throw a warm bounce patch across the floor and the lower wall.
- Delete or dress the left-side black slab and the bare poles. Dress the room with furniture, cloth and debris along the walls.

---

## 3. detail.png (market cover, close props)

**Blind verdict:** IMITATION, 96%.

**Side-by-side vs mw3-2011-paris-street.webp** (sandbags and market dressing): MW3 2011 wins by about 3 points, even on its old engine. Its sandbags are burlap with weave and sag, its sign has hand-painted lettering, and its debris has identity. The candidate's background (arch at (540,190)-(680,300), palm, stalls) has decent depth and haze, which is the frame's best part.

**Score:** 3/10

**Tells, most damaging first**
1. **Crates** at (0,280)-(410,720) and (400,345)-(590,610). They are bevelled boxes with faint smudges, no grain, no stencils, no nails and no straps. The lid at (395,340)-(500,410) is a floating slab.
2. **Canopy** at (270,0)-(810,190). It is still noisy red/green felt with a rigid hard fold and no sag. The HUD compass sits on top of it and becomes unreadable.
3. **Viewmodel** at (600,350)-(1280,720). The rifle is navy blue-black and flat with the same LEGO rail. The mitten glove is tan here, so it changes colour between frames.
4. **Sandbags** at (700,405)-(1060,590) are smooth puffy capsules.
5. **Pillar** at (815,0)-(920,470) is a clean box, and the floor tiles at (300,600)-(800,720) are uniform.

**Top 3 fixes**
- Rebuild the hero crates with wood grain, stencilled lettering, metal corner brackets and chipped edges.
- Make the canopy fabric hang: catenary sag between the poles, a woven texture at real scale and backlit translucency.
- Add grime and dirt gradients where every prop meets the floor.

---

## 4. sunset.png (golden hour)

**Blind verdict:** IMITATION, 96%.

**Side-by-side vs warzone-verdansk.webp** (backlit haze): Verdansk wins by about 5 points. Verdansk's backlit haze has layered aerial perspective, cool shadows and a fully readable gun. The candidate now has a hazy sun glow at (300,180)-(700,320) and a warm sky gradient, which is a clear improvement on round 0's flat sepia.

**Score:** 3/10

**Tells, most damaging first**
1. **Black viewmodel** at (560,350)-(1280,720), mean luma about 5. A third of the frame is a black hole, with only the blue lens ring at (900,395)-(960,460) reading.
2. **Clouds** at (650,0)-(900,110) and (640,160)-(770,195). They are flat orange paper cutouts with hard edges and no internal shading.
3. **No warm/cool split.** Shadows are still brown-black, for example the right facade's lower half at (1080,400)-(1280,600) and the left stalls at (40,400)-(300,560). There is no cool sky fill.
4. **No volumetrics.** There are no god rays down the street, even though the sun sits right at the vanishing point. The street at (420,380)-(780,460) collapses into a silhouette with no rim light.
5. **Brick column** at (0,120)-(45,640) is a flat repeating tile.

**Top 3 fixes**
- Rim-light the viewmodel with the warm sun and give it cool fill, so the receiver edges and the scope catch orange highlights.
- Add sun shafts and dust down the street axis and rim light on the stall silhouettes.
- Cool the shadows toward blue-grey and lift them to readable detail. Replace the cutout clouds with soft, internally shaded ones.

---

## 5. night.png

**Blind verdict:** IMITATION, 99%.

**Side-by-side vs mw3-2011-prague.webp** (overcast dusk with practicals): Prague wins by about 6 points, even as a 2011 frame. Prague's lights live in the world: lamps, fires and a lit gun. The candidate's night is still a daytime map with a filter.

**Score:** 2/10

**Tells, most damaging first**
1. **Sky.** The clouds at (420,190)-(730,240) and (640,0)-(900,170) are still bright white and sunlit. The moon at (283,133) is a flat white blob. The sky splits into a bright, almost daylit wash on the left half at (180,0)-(620,300) and deep navy on the right. Nothing about it is night.
2. **Uniform orange ground.** The entire ground plane at (180,420)-(1280,720) is the same saturated orange, with no pools or falloff. It reads as a global tint, not sodium lamps. The lamp at (140,0)-(210,30) is still the only visible source.
3. **Black viewmodel** at (560,350)-(1280,720), mean luma about 20 and blue-black.
4. **Purple barriers.** The Jersey barriers at (0,500)-(320,700) and (470,460)-(610,580) are lit violet-blue against the orange ground, which looks like a broken light-channel mix.
5. **Over-lit facades.** The left facades at (0,90)-(340,470) are evenly lit warm orange, with no dark gaps between light sources.

**Top 3 fixes**
- Make a true night sky: near-black blue, dim moonlit cloud edges only, and a moon with a soft halo.
- Light the world with discrete lamp pools that fall off into darkness between them, plus lit windows and signs.
- Give the viewmodel a faint cool moon rim plus warm lamp spill so its shape reads.

---

## 6. weapon.png (market street, idle weapon)

**Blind verdict:** IMITATION, 96%.

**Side-by-side vs mw2019-hands-firefight.webp:** MW2019 wins by about 7 points, and this is the most damning comparison in the set. MW2019 shows a real hand with knuckles and a watch strap gripping a scuffed receiver with stamped serials and a carry-handle sight with depth. The candidate shows a grey toy rifle and a mitten.

**Score:** 3/10

**Tells, most damaging first**
1. **Rifle** at (730,350)-(1280,720). It is grey matte plastic with chunky rail teeth. The "markings" at (770,680)-(800,720) are a tiny, illegible scribble, and there is no wear and no material separation between polymer and metal.
2. **Glove** at (600,425)-(750,700) is a mitten with no fingers, and the dither stipple is visible.
3. **Sandbags** at (140,525)-(470,720). These are worse than round 0. They are smooth beige pancakes that read as cookies or bread loaves, with a plastic-like sheen.
4. **Gas cylinder** at (460,550)-(530,720) is a clean green tube with no label or dents, sitting dead centre in the foreground.
5. **Barrels** at (0,520)-(85,640) and (1150,430)-(1280,550) are clean cylinders.
6. **Floating leaves.** The leaf scatter at the top right (1060,0)-(1280,200) is a noisy yellow dot spray.

**Top 3 fixes**
- Remodel and retexture the rifle at hero fidelity: stamped markings, screws, a bolt catch, an ejection port, a worn finish and differentiated polymer and metal.
- Replace the mitten with a real glove grip.
- Replace the pancake sandbags with burlap bags that show seams, tie-offs and stack compression.

---

## 7. ads.png (aim down sights)

**Blind verdict:** IMITATION, 98%.

**Side-by-side vs warzone-verdansk.webp** (optic-forward framing): Warzone wins by about 6 points. Its optic has a real objective lens and a worn camo receiver. The candidate now has DOF on the near rail at (560,600)-(780,720) and a soft-focus world, which is real progress.

**Score:** 3/10

**Tells, most damaging first**
1. **Square behind the reticle.** An opaque dark square quad at (595,315)-(685,400) sits behind the red dot. This is a blatant render bug and the first thing any viewer sees.
2. **Rail** at (560,600)-(780,720). Even blurred, it is chunky stacked black/white bars, like a tyre tread.
3. **Glove** at (440,450)-(580,720). It is a tan mitten with no fingers wrapping the handguard.
4. **Optic body** at (490,200)-(800,480). It has a halo of dithered sparkle around the rim, and the glass at (560,280)-(720,440) has no reflection or dirt. The eyebox shows no tunnel shadow.
5. **Reticle** at (620,340)-(660,380) has a decent glow, but the glow bleeds into the square artifact.

**Top 3 fixes**
- Delete the dark quad behind the reticle. The dot should float on clear glass with the world visible behind it.
- Add a lens tint, a faint sky reflection and a darkened eyebox ring.
- Show a gloved hand with fingers on the handguard, or crop it out of the ADS view.

---

## 8. muzzle.png (firing)

**Blind verdict:** IMITATION, 97%.

**Side-by-side vs mw2019-hands-firefight.webp** (enemy muzzle flash at (820,200)-(960,360)): MW2019 wins by about 6 points. Its flash has a hot core, ragged flame tongues, smoke and an orange light cast on the shooter's arm. The candidate's flash is a clean six-point vector star.

**Score:** 3/10

**Tells, most damaging first**
1. **Flash shape** at (550,290)-(790,510). It is a symmetrical, smooth-edged six-pointed star, which reads like clip art or an emoji, not combustion. It has no smoke, no heat haze and no frame-to-frame irregularity, and it is drawn over the glove rather than at the muzzle.
2. **Dither/stipple** on the viewmodel at (600,330)-(1280,720). Zoomed 2x, a clear checkerboard pattern covers the scope and glove. This is the same bug class as round 0's speckle and it is still not fixed.
3. **Flash light.** The flash lights only a thin sliver of the glove top. The sandbags at (140,520)-(470,720) and the barrel at (495,450)-(570,570) get no orange pop.
4. **Glowing cylinder** at (1180,380)-(1260,420): a bright yellow glowing object at the right edge. It is either a casing or a lamp, and it reads as a stray emissive prop.
5. **No recoil.** The pose is identical to idle (compare weapon.png). There is no kick, no camera shake and no motion blur.

**Top 3 fixes**
- Replace the star with an irregular flame flipbook: a white-hot core, ragged orange forks and a grey smoke puff that persists.
- Flash the world: an orange light pulse on the glove, rifle, sandbags and ground for one or two frames.
- Add recoil: the rifle kicks up and back, and brass ejects right.

---

## 9. combat.png (enemies on street)

**Blind verdict:** IMITATION, 98%.

**Side-by-side vs mw3-2011-paris-street.webp:** MW3 2011 wins by about 5 points. Its enemies are full-detail operators with helmets, plate carriers, readable faces and lit muzzle flashes, and they are framed in open sightlines. In the candidate the enemy is hidden.

**Score:** 3/10

**Tells, most damaging first**
1. **Enemy** at (250,380)-(330,480). It is a dark, unreadable lump standing directly behind a pole, the same staging problem as round 0. The zoomed crop shows no helmet, carrier or face. The only proof it is a person is the muzzle star at (270,400)-(290,430).
2. **Black viewmodel** at (600,350)-(1280,720), mean luma about 10, even though the street right of centre is sunlit.
3. **Tracers.** The orange tracer lines from (0,460) to (640,355) and from (800,310) to (1280,250) are dotted-dash lines that read as laser beams. They are too long, too thin and visible over their whole length simultaneously.
4. **Tyre stack** at (360,410)-(440,520) is still blue-grey stacked plates.
5. **Floor debris** at (0,470)-(560,690) is grey blocks and a broken wing-like slab at (70,620)-(250,690) with no identity.
6. **Kill feed.** "ENEMY [gun] OPERATOR" at (25,615)-(170,630) uses placeholder names.

**Top 3 fixes**
- Put enemies in clear sightlines with modern operator models: helmet, carrier, pouches and a readable silhouette.
- Make tracers short, bright, travelling streaks, about 10% of the path at a time.
- Light the viewmodel independently. It must never go black in a daylight frame.

---

## 10. impacts.png (bullet impacts)

**Blind verdict:** IMITATION, 97%.

**Side-by-side vs mw3-2011-paris-street.webp** (explosion and debris): MW3 wins by about 4 points. The candidate's dust plume is the biggest single FX improvement this round.

**Score:** 3/10

**Tells, most damaging first**
1. **Shell casings** at (1110,390)-(1250,575). They are huge pale yellow sticks, about 60-70 px long, that look like popsicle sticks. They float at the far right edge, nowhere near the ejection port. The scale is wrong by roughly 4x.
2. **Kneeling enemy** at (560,380)-(640,500). It is a dark grey blob with no readable anatomy or gear, and it sits half-buried in the dust.
3. **Fabrics.** The mustard cloth at (785,190)-(920,270) and (120,300)-(290,355) and the red wall at (1070,250)-(1280,520) are still high-frequency noise textures, like a 90s carpet. The striped awning at (630,80)-(1140,215) has the same grain.
4. **Black viewmodel** at (600,350)-(1280,720), mean luma about 15.
5. **Background building** at (485,140)-(610,380) is a flat dark-blue plane with no windows.
6. **Plume.** The dust plume at (600,250)-(720,420) with sparks is solid work, but it has no debris chunks and no visible hole decal on the wall.

**Top 3 fixes**
- Make casings brass-coloured, about 15 px long, and eject them in an arc from the right side of the receiver.
- Retexture all fabrics with a woven pattern at real-world scale. The noise grain must go.
- Add persistent bullet-hole decals and chips flying from the struck material.

---

## 11. hud.png (full HUD)

**Blind verdict:** IMITATION, 85%. This is the closest frame in the set. The HUD alone could fool a casual viewer for a second.

**Side-by-side vs mw2019-mp-tdm.png:** MW2019 wins by about 2-3 points. The candidate now has a compass with a heading readout, a kill feed on dark plates, a "Hold F" prompt on a plate, a yellow "+100 KILL" splash, a grenade warning, a damage-direction arc and a score/rank block. That is the right vocabulary.

**Score:** 5/10

**Tells, most damaging first**
1. **Font.** Everything uses a generic humanist sans (Liberation/DejaVu-like). The ammo "19" at (1160,650)-(1195,680) and the "+100" at (615,395)-(665,412) lack CoD's condensed display face.
2. **Compass** at (430,10)-(700,30). It has thin grey ticks floating on bright sky with no backing, so it washes out. The heading "326" is the only legible element.
3. **Minimap** at (20,20)-(178,178). It is a grey block plan with no roads, labels or detail, and the red enemy dots are tiny.
4. **Grenade indicator** at (460,415)-(495,445). The "GRENADE" text is microscopic and the red ring is weak.
5. **Score block** at (20,650)-(75,700). "43 / 38" has no team colour coding and no score bar.
6. **World.** The frame is the hero shot with the HUD layered on, so it inherits all the gun and surface tells.

**Top 3 fixes**
- License or build a condensed, bold display face for ammo, score, splash and compass.
- Put the compass on a subtle dark gradient band and make the ticks thicker and brighter.
- Give the score block team colours (blue and red) with a progress bar, and give the minimap roads, building edges and larger icons.

---

## Overall top 10 problems, ranked across all frames

| # | Problem | Frames | Owner |
|---|---|---|---|
| 1 | The viewmodel goes **pitch-black in any shaded scene**: gun-region luma about 4-20 against 56-67 when sunlit. A third of the frame becomes a black cutout. | interior, sunset, night, combat, impacts | lighting/grade |
| 2 | The rifle is **matte grey plastic**: LEGO rail teeth, no wear, no sheen, no material separation, illegible markings and a dead grey lens. | all | viewmodel/hands |
| 3 | A **checkerboard dither/stipple** covers every viewmodel surface (the round-0 speckle bug, now persistent rather than only on fire). It is worst in muzzle and around the optic rim in ads. | all viewmodel frames | lighting/grade (render bug) |
| 4 | **ADS reticle sits on an opaque dark square** at (595,315)-(685,400). | ads | viewmodel/hands |
| 5 | The **left hand is a giant fingerless mitten** with two pads, its colour shifts between tan and dark across frames, and there is no right hand. | all | viewmodel/hands |
| 6 | **Enemies are unreadable dark lumps** hidden behind poles or in dust, with no helmet, carrier, face or silhouette. | combat, impacts | characters |
| 7 | **Night is still a filtered day**: sunlit white clouds, a moon blob, a bright half-sky, a uniform orange ground with no lamp pools and violet barriers. | night | lighting/grade |
| 8 | **Muzzle flash is a clip-art six-point star**. Casings are 4x oversized popsicle sticks in the wrong place, tracers are full-length laser lines, and there is no recoil or world flash-light. | muzzle, impacts, combat | FX |
| 9 | **Props and fabrics are clean or noisy**: bevelled crates, pancake sandbags, felt and carpet-noise cloth, clean barriers and barrels, and a black slab in interior. | detail, weapon, impacts, interior, hero | environment |
| 10 | The **HUD typeface is generic sans**, the compass is unbacked and washes out on the sky, the minimap is a placeholder, and the kill feed uses placeholder names. | hud, all | HUD |

**Priority call:** fix #1, #3 and #4 first. They are cheap rendering fixes that remove the loudest "broken" reads. Then fix #2 and #5, the asset rebuild of the rifle and hands, which is still the ceiling on every frame.

---

## Round 0 vs round 1

| Frame | R0 | R1 | Delta | What changed |
|---|---|---|---|---|
| hero | 3 | 4 | +1 | The plank arm is gone (mitten instead). The street gained wires, AC units, signage and balconies, and the sky and haze are much better. The rifle is still grey plastic, and the dither persists. |
| interior | 2 | 2 | 0 | The wall gained stain decals, and the shelves now have brackets. **Regression:** the viewmodel is now pure black. The black slab on the left is still present. |
| detail | 2 | 3 | +1 | Better background depth and haze. The crates and canopy are essentially unchanged, and the gun is navy-black. |
| sunset | 3 | 3 | 0 | The sky gradient and sun glow replace the flat sepia (an improvement). **Regression:** the viewmodel is a black hole, and the clouds are paper cutouts. |
| night | 2 | 2 | 0 | Warm practical tint was added, but the ground is a uniform orange wash, the sky is still daylit, and there are violet barriers. The black gun is a lateral move: worse in a different way. |
| weapon | 3 | 3 | 0 | The arm is replaced by the mitten. **Regression:** the sandbags now read as cookies or pancakes. The rifle is unchanged in fidelity. |
| ads | 3 | 3 | 0 | Near-field DOF and a reticle glow were added (an improvement). **Regression:** the opaque square artifact behind the reticle. |
| muzzle | 2 | 3 | +1 | The flash now has shape and tracers are present, but it is a clip-art star. The speckle has turned into a uniform dither, which is less noisy but still visible. |
| combat | 2 | 3 | +1 | Tracers, an impact puff and a kill feed were added. The enemy is still hidden behind a pole and unreadable. **Regression:** the viewmodel is black in daylight. |
| impacts | 2 | 3 | +1 | The dust plume with sparks is a real improvement. **Regression:** the giant popsicle-stick casings. The fabrics are still carpet noise. |
| hud | 4 | 5 | +1 | Plated kill feed, plated prompt, kill splash, grenade warning, damage arc and heading readout. The mode is now coherent. The font is still generic. |
| **Average** | **2.5** (published 2.4) | **3.1** | **+0.6** | |

**Improved:** environment set dressing and sky, HUD language, the removal of the plank arm, impact dust, ADS DOF, and muzzle flash shape.

**Regressed:** viewmodel lighting, which is now black in 5 of 11 frames. There is a new ADS square artifact, the casings are oversized, and the sandbags are pancakes. None of these regressions existed in round 0. They are self-inflicted and should be fixed before any new feature work.
