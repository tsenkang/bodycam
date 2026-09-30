# Art Director Review, Round 0 (blind)

Frames: 1280x720. Coordinates are (x,y) in frame pixels.

## Bottom line

**All 11 frames: IMITATION, 97-99% confidence.** Nothing here would pass as a capture from MW2019, MWII, MWIII or BO6, even to a casual player. The environment blockout and sun/shadow setup are the strongest work and read roughly as a mid-2000s Source/early-UE3 level with a modern TAA-and-bloom pass on top. The **viewmodel is the single biggest giveaway, and it appears unchanged in 10 of the 11 frames**. The rifle is a dark grey kitbash with no material separation. Neither arm is an arm: the left forearm is a flat rust-brown plank and the right hand is a brown lump. Characters are low-poly army men with mottled vertex-color camo. The FX are sprites. The HUD is the closest to shippable, but it reads as a 2014-era fan layout rather than the modern CoD language.

Average score: **2.4 / 10**.

---

## 1. hero.png (daytime street, hip-fire)

**Verdict:** IMITATION, 98%. **Score:** 3/10

**Tells, most damaging first**
1. **Left forearm and hand.** A flat, untextured rust-brown plank runs diagonally from (420,720) to (660,450) and ends in a rectangular brown "hand" block at about (620-770,450-560). It has no fingers, glove seams, sleeve cuff, fabric folds or wrist articulation. CoD hands are photogrammetry gloves with stitching, knuckle creases and sleeve cloth. This one element sinks the frame.
2. **Right hand.** The brown claw shape at (1100-1280,600-720) has no readable fingers or trigger-finger pose and no glove material. It reads as a prop.
3. **Rifle material.** The receiver and handguard at (700-1100,400-720) are uniform dark slate with no anodized-aluminium sheen, no Cerakote, no edge wear and no roughness variation. Specular is almost absent. The scope at (830-960,410-510) is a clean cylinder with a flat dark lens and no lens coating tint or reflection.
4. **Materials and geometry.** The Jersey barriers at (0,470)-(320,700) and (460,455)-(710,590) are clean extrusions with no chips, graffiti, grime at the base or ground contact. Building facades on both sides are single-plane boxes with tiling plaster and no trim, sills, cracks, AC stains or cable clutter. Balconies at (1100,40)-(1280,200) are thin box rails.
5. **Ground.** The sand at (300,460)-(800,720) is one tiling noise texture. It has no tire tracks, footprints, debris decals, puddles, height blending into the concrete or scattered props.
6. **Lighting and grade.** The shadow side of the street at (0,150)-(330,480) has bluish flat ambient with no bounce from the sunlit sand. There is no GI and no contact-shadow darkening where walls meet the ground. The sky at (140,0)-(900,300) is a bright painted dome whose clouds look like a photo cutout, with no aerial perspective. The distant arch at (580,290) is too contrasty for the distance.
7. **Foliage.** The bush at (1140,460)-(1260,560) is a scatter of green alpha cards with no shading, and it looks pasted on.

**Top 3 fixes**
- Replace the viewmodel arms with real skinned gloved hands and sleeves: fingers wrapped on the handguard, visible stitching, cuff and fabric, and a proper grip on the pistol grip.
- Give the rifle PBR materials: roughness breakup, edge wear on high points, anodized sheen, and a lens with coating tint and an environment reflection.
- Add large-scale grime and contact detail to every surface: base dirt on walls, decals, cracks, chipped barriers, and dense set dressing on the ground.

---

## 2. interior.png (looking out of a room)

**Verdict:** IMITATION, 99%. **Score:** 2/10

**Tells, most damaging first**
1. **Wall material.** The walls around the opening at (0,0)-(1280,580) are one flat terracotta-brown color with a faint noise texture. There is no plaster breakup, peeling paint, AO in the corners or structure in the dust. They read as a 2006 dev texture.
2. **Exposure.** The exterior through the opening at (455,190)-(940,420) is exposed about the same as the interior. A real CoD interior shot blows out the exterior or pushes the interior darker, with strong bounce light spilling in across the floor and walls. Here the interior light doesn't match the exterior sun.
3. **Geometry.** The floating plank "shelves" at (100,385)-(560,410) and (1010,415)-(1280,440) are unsupported bars with no brackets, and the vertical poles at (330,40)-(350,700) and (540,60)-(560,560) are untextured grey lines. Nothing here has been dressed as a lived-in room. There is no furniture, clutter, cloth or debris.
4. **Dark shape.** A black blob at (0,280)-(130,560) on the left has no readable form, like a missing texture or an unlit mesh.
5. **Viewmodel.** The viewmodel has the same issues as hero, and in this low light the plank arm looks even more like wood.

**Top 3 fixes**
- Build real interior lighting: sun bounce and GI from the opening, dark corners, and an exposure difference between interior and exterior.
- Replace the flat wall shader with layered plaster, damage, dirt gradients and AO.
- Dress the room with furniture, debris, cables, a rug and posters, and give every plank visible support.

---

## 3. detail.png (market cover, close props)

**Verdict:** IMITATION, 98%. **Score:** 2/10

**Tells, most damaging first**
1. **Close-up prop fidelity.** This frame exists to show close props, and that is where the gap is widest. The crates at (0,280)-(410,720) and (400,345)-(590,580) are bevelled boxes with a flat grey-brown albedo. There is no wood grain, stencilling, nails, straps or edge wear, and the lids are just rotated slabs.
2. **Canopy.** The red and green canopy at (270,0)-(810,110) uses a low-resolution noisy texture, so it reads as felt, and it has no cloth sag physics. It hangs as a rigid plane with a hard fold edge.
3. **Sandbags.** The sandbags at (700,400)-(1060,590) are smooth inflated capsules with no burlap weave, tie-offs or stack settling.
4. **Pillar and floor.** The concrete pillar at (815,0)-(920,470) is a clean box. The floor tiles at (590,560)-(800,720) are uniform, with no grout dirt or wear.
5. **Background.** The background street at (400,120)-(820,330) has soft haze but no depth-of-field or atmospheric scattering. The blue-grey shadow tint is uniform everywhere.
6. **Viewmodel.** Same plank arm and flat rifle as the other frames.

**Top 3 fixes**
- Rebuild the hero props at modern CoD density: bespoke normals, wood grain, stencils, metal hardware and wear masks.
- Give cloth real weight: sag, draped folds, woven fabric texture and translucency when backlit.
- Lay grime and decals along every ground-to-object contact line.

---

## 4. sunset.png (golden hour)

**Verdict:** IMITATION, 97%. **Score:** 3/10

**Tells, most damaging first**
1. **Grade.** The whole frame has a uniform sepia wash. Sky, walls, ground and gun are all the same orange-brown, so it looks like a filter rather than light. Real golden hour in MWII has cool blue shadow fill against warm key light, and this frame has no color separation at all.
2. **Shadows.** Shadows are crushed to near-black brown, for example the street-level alcove at (240,390)-(300,500) and the right-side windows at (1080,400)-(1200,560), with no sky fill.
3. **Sun.** The sun at the vanishing point (650,300) has no flare, no volumetric shafts through the wires and awnings, and no god rays down the alley, which is the whole point of the shot.
4. **Vines.** The vines at (40,160)-(300,340) are flat dark alpha cutouts that read as decals.
5. **Geometry.** The street stalls at (490,380)-(780,460) collapse into a single silhouette with no rim light. The brick column at (0,180)-(50,600) is a flat repeating brick tile.

**Top 3 fixes**
- Split the grade: warm sun key and a cool sky-fill shadow, and keep the neutral mid-tones out of the orange LUT.
- Add volumetric sun shafts, a lens flare and dust in the air at the end of the street, and rim-light the silhouettes.
- Lift the shadow floor so there is readable detail at around 5-8% luminance.

---

## 5. night.png

**Verdict:** IMITATION, 99%. **Score:** 2/10

**Tells, most damaging first**
1. **Sky.** The sky is the daytime cloud dome with its exposure lowered. The clouds at (420,110)-(900,280) are still bright white, sunlit and high-contrast, which is impossible at night, and they show posterized banding. The moon at (283,133) is a flat white blob with no halo or bloom.
2. **Lighting.** Local lights barely exist. The streetlamp at (140,0)-(210,40) blows out but casts no light pool on the ground below it at (80,400)-(250,600). The right-hand lamp at (790,265) lights nothing. Practical lights are the whole art direction of a CoD night map, and here they are missing.
3. **Sun leakage.** The walls on the left at (0,90)-(340,420) are lit warm orange from an unseen direction, which reads as the sun still leaking through.
4. **Viewmodel.** The viewmodel goes nearly black at (420,440)-(1280,720) because there is no local fill, and at night the plank arm reads as a stick.
5. **No night language.** There is no NVG or IR look, no lit windows and no emissive signage. The frame looks like a dimmed day.

**Top 3 fixes**
- Build a real night sky: dark, low-contrast clouds lit only by the moon and city glow, and a moon with a halo.
- Add dozens of practical lights with shadowed pools on the ground, lit windows and emissive signs.
- Give the viewmodel a subtle local fill or rim light so it reads against the dark.

---

## 6. weapon.png (market street, idle weapon)

**Verdict:** IMITATION, 97%. **Score:** 3/10

**Tells, most damaging first**
1. **Weapon.** This frame is meant to showcase the gun, and it shows a dark grey kitbash. The receiver at (700,450)-(1100,720) has no manufacturer markings, fire-selector detail, bolt-carrier gleam, screws or material separation between polymer and metal. The stock and grip vanish behind the brown blob at the bottom right.
2. **Arms.** The plank arm runs from (420,720) to (660,450). The left "hand" at (620-770,445-560) is a two-tone brown box with a thumb-like tab.
3. **Hero sandbags.** The sandbags at (140,525)-(470,720) are glossy, cookie-shaped capsules with no fabric texture.
4. **Props.** Barrels at (495,450)-(570,570) and (0,520)-(90,640) are clean cylinders with a flat stripe. The white bottle at (460,550)-(530,660) has no label or dirt.
5. **Scale.** The green stall cloth at (30,300)-(490,360) is noisy felt. Stall props such as the bread and fruit at (190,440)-(280,470) are tiny and unreadable. The scale doesn't sell a market.
6. **Foliage.** Foliage at the top right (1000,0)-(1280,200) is a noisy sprinkle of yellow-green alpha dots.

**Top 3 fixes**
- Remodel the weapon at hero fidelity: markings, screws, ejection-port detail, differentiated polymer and metal, wear, and sling or accessory attachments.
- Rebuild the arms with anatomy and gear: gloves, watch, sleeves and patches.
- Replace capsule sandbags and flat props with scanned-quality assets.

---

## 7. ads.png (aim down sights)

**Verdict:** IMITATION, 96%. **Score:** 3/10 (the best viewmodel frame, because the arms are mostly hidden)

**Tells, most damaging first**
1. **No ADS rendering.** There is no depth-of-field on the weapon and no ADS FOV zoom beyond a small change. The rear of the optic at (490,205)-(800,480) is sharp while the world is sharp too. Modern CoD blurs the near viewmodel geometry heavily and adds a lens vignette.
2. **Glass.** The sight glass at (560,285)-(720,440) has no parallax shadow, no eye-box tunnel, no lens dirt and no reflection. It is a transparent disc with a blue rim ring. The reticle at (620,340)-(660,380) is a flat red dashed circle with no emissive glow bleed.
3. **Left glove.** The left glove at (300,420)-(580,720) is visible here as brown rectangles with a fuzzy fabric texture. It has no fingers and is blocky.
4. **Rail.** The rail at (560,600)-(780,720) is repeating box teeth with no bevels.
5. **Bottle.** The bottle at (400,650)-(460,720) intersects the viewmodel space without being occluded properly. It floats in front of the gun volume.

**Top 3 fixes**
- Add ADS DOF on the weapon, a lens vignette and a scope shadow or eye-box as the sight settles.
- Give the reticle HDR glow and add glass reflection and grime.
- Hide or rebuild the left hand. At ADS it should be a readable gloved hand on the handguard.

---

## 8. muzzle.png (firing)

**Verdict:** IMITATION, 98%. **Score:** 2/10

**Tells, most damaging first**
1. **Muzzle flash.** The flash at (630,380)-(800,470) is one soft orange additive blob that sits on top of and behind the hand geometry. It has no core, no star petals, no smoke, no heat haze and no sparks. CoD flashes are multi-layer flipbooks with a hot white core, a flame fork and immediate smoke.
2. **Speckle artifacts.** Pixel-noise speckles cover the whole rifle and plank arm at (430,450)-(1280,720). There are bright white specks along every edge, which looks like broken specular aliasing or a noisy shadow-map or SSR pass. This is an obvious rendering bug.
3. **Flash light.** The flash lights nothing. The sandbags, ground and the arms right next to it don't pick up the orange light.
4. **Posture.** There is no recoil kick or motion blur, and the weapon pose is identical to idle.
5. **Missing firing FX.** There are no ejected casings and no brass. The orange streaks near (620,390) are the only tracer-like elements, and they are tiny.

**Top 3 fixes**
- Build a proper layered muzzle flash (core, petals, smoke puff, sparks, heat distortion) with a dynamic light that lights the gun, hands and nearby world for 1-2 frames.
- Kill the speckle noise on the viewmodel: fix specular aliasing, the shadow-bias or SSR noise, and TAA on viewmodel pixels.
- Add recoil pose, casing ejection and short motion blur.

---

## 9. combat.png (enemies on street)

**Verdict:** IMITATION, 98%. **Score:** 2/10

**Tells, most damaging first**
1. **Enemy characters.** Enemies at (270,340)-(320,480) and (895,355)-(925,400) are low-poly figures with mottled green-tan vertex-noise camo. They have no readable faces, no plate carriers, no pouches and no silhouette detail, and they read like PS2 soldiers. The rifle held by the left enemy is a single brown stick at (240,390)-(340,400) sticking through the pole.
2. **Blue enemy blob.** A glowing-blue figure at (825,355)-(875,470), zoomed, is a wireframe-ish or highlighted blob that blends into the scene. The red and blue blotch at (990,350)-(1050,390) is unreadable.
3. **Wrong hierarchy.** Nothing about the enemies pops. There is no rim light and no contrast from the background, and the left enemy is hidden behind a pole while reading as the same color as the wall.
4. **Floor props.** The floor props at (0,480)-(560,690) are scattered grey boxes and triangular slabs with no identity. The stacked "tire" pile at (360,410)-(440,520) looks like blue-grey plates.
5. **Orange wall.** The orange wall at (0,0)-(150,390) is a flat noise texture.
6. **Viewmodel.** Same viewmodel issues as the other frames.

**Top 3 fixes**
- Replace the characters with modern operator models: plate carriers, helmets, faces, detailed weapons and proper hand IK on those weapons.
- Improve character-to-background separation: rim light, color contrast, and removing the noisy camo that dissolves at distance.
- Replace debris with authored rubble kits.

---

## 10. impacts.png (bullet impacts)

**Verdict:** IMITATION, 99%. **Score:** 2/10

**Tells, most damaging first**
1. **Impact FX.** The only impact FX is one soft white puff at (640,310)-(675,345). It has no spark burst, no dust plume keyed to the material, no debris chunks and no persistent bullet-hole decal. CoD impacts are material-specific (concrete dust, cloth tear, metal sparks) and leave holes.
2. **Kneeling enemy.** The enemy at (555,370)-(620,500) has the same army-man issues as in combat. Their weapon is a thin stick and the pose is stiff.
3. **Cloth texture.** The cloth hangings at (610,150)-(760,360) and (780,190)-(920,270) use a garish high-frequency noisy mustard texture. The red wall on the right at (1070,250)-(1280,520) is a red noise field, like a 90s carpet.
4. **Background plane.** The background building at (485,140)-(610,380) is a flat dark-blue plane.
5. **Lighting.** Lighting is flat and grey throughout, and nothing looks sunlit.

**Top 3 fixes**
- Build material-aware impact FX: sparks, dust, debris, and a decal that persists on every hit.
- Retexture fabrics with woven detail at the right scale and add cloth deformation on impact.
- Fix the characters as in combat.

---

## 11. hud.png (full HUD)

**Verdict:** IMITATION, 90%. **Score:** 4/10 (strongest frame)

**Tells, most damaging first**
1. **Wrong game's language.** The HUD layout is plausible, but the language belongs to a different game. The compass at (490,10)-(790,30) is a thin dark bar with small tick marks, which is closer to an MW2019 bar. The score block at (580,42)-(700,56) uses a tiny font and the "TDM 4:06" is barely readable. Modern CoD uses bolder condensed type with a distinct score plate.
2. **Health bar.** "HEALTH 62/100" with a segmented bar at (15,670)-(150,705) is a BR/DMZ-style armor-plate display pasted into TDM. It reads as a fan mock-up.
3. **Minimap.** The minimap at (15,15)-(137,137) is a flat grey tile map with coarse diagonal geometry and no roads, building outlines or fine detail. Its enemy markers are small red triangles.
4. **World markers.** "31M EXFIL", "27M PLANT" and "29M HOLD" float at (35,360), (565,365) and (995,370). They are tiny, low-contrast and inconsistent with each other, and EXFIL, PLANT and TDM together don't make sense for one mode.
5. **Pickup prompt.** "PICK UP AMMO / HOLD" at (590,408)-(700,425) has a box key icon but no background plate, so it vanishes against the sky.
6. **Font.** The ammo counter "26/94" at (1170,655)-(1265,690) is a close enough size, but it uses a generic sans (DejaVu-like). CoD uses its own condensed display face.
7. **Kill feed.** The kill feed at (1130,20)-(1265,70) is readable and fine. It is the most CoD-like element.

**Top 3 fixes**
- Adopt a proper condensed display typeface and bump the size and contrast of the score, compass and prompts. Put the prompts on subtle dark plates.
- Make the minimap real: building outlines, a street grid and proper player and enemy iconography.
- Make the mode coherent: one objective set, and no DMZ health or armor bars in TDM.

---

## Overall top 10 problems, ranked across all frames

| # | Problem | Frames | Owner |
|---|---|---|---|
| 1 | The left forearm is a flat untextured rust-brown plank (about (420,720)-(660,450)), and both "hands" are blocky brown lumps with no fingers, glove material or sleeve. This is in every non-ADS frame and is the single fastest "fake" tell. | all except ads (partly visible there) | viewmodel/hands |
| 2 | Enemy characters are low-poly army men with noisy vertex camo, stick rifles, no gear silhouette, no faces and stiff poses. | combat, impacts | characters |
| 3 | The rifle has no PBR material separation, no markings, wear or sheen, and a dead lens. A severe white speckle-noise artifact covers the viewmodel when firing. | all; speckle in muzzle | viewmodel/hands (rendering bug: lighting/grade) |
| 4 | Night is a dimmed day: sunlit white clouds, a blob moon, no light pools from practicals and warm sun leakage on the walls. | night | lighting/grade |
| 5 | There is no GI or bounce and interiors don't expose against exteriors. Shadows are a flat blue-grey ambient, and nothing grounds objects (no AO or contact darkening). | interior, hero, detail, combat, impacts | lighting/grade |
| 6 | Environment surfaces are clean tiling textures on simple boxes: barriers, walls, crates, sandbag capsules, felt-noise cloth and a flat terracotta interior wall. There are no grime, decals, damage or trim. | all | environment materials/geometry |
| 7 | Muzzle flash and impacts are single soft blobs. There is no core, petals, smoke, sparks, material-specific impacts, decals, casings or dynamic flash light. | muzzle, impacts | FX |
| 8 | The sunset grade is a monochrome sepia wash with crushed black shadows and no volumetrics, flare or warm/cool split. | sunset | lighting/grade |
| 9 | There is no ADS camera treatment (weapon DOF, eye-box, vignette), and the reticle has no HDR glow or glass reflection. | ads | viewmodel/hands (with lighting/grade for DOF) |
| 10 | The HUD uses a generic sans font, has a tiny low-contrast score, compass and prompts, a flat placeholder minimap and incoherent mode elements (EXFIL, PLANT and DMZ armor in TDM). | hud, all | HUD |

**Priority call:** fix #1 and #3 first. The viewmodel covers about 30% of every frame, so no amount of environment work will make a frame pass while those arms are on screen.
