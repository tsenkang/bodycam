# Opus of Duty — agent brief

Read this and `ARCHITECTURE.md` before touching code. `ARCHITECTURE.md` rules
still apply: you own your directories, reach other subsystems through
`ctx.get()`, add no npm deps or external assets, don't use `Math.random()`, and
don't allocate per frame.

## Where we start

This is a fork of *Claude of Duty*. Its own README scores it 5.05/10 against
modern Call of Duty, and every blind critic picked real CoD. The weaknesses it
documents, worst first:

1. **Hands.** Blocky finger slabs that don't grip the weapon. In the baseline
   `hero` frame the left arm is a flat brown plank crossing the screen.
2. **Viewmodel lighting.** The view rig in `src/render/index.js` delivers about
   20× the world's irradiance per unit albedo, so every weapon albedo is cheated
   to a third of physical. That caps material separation on the object players
   look at most.
3. **Material richness.** Surfaces read as procedural noise, not photographed
   surfaces.
4. **Characters.** Enemies read as mannequins at distance.
5. **Indirect light.** An approximation, not GI.

Their process note: tonemapping, sky and indirect light are one coupled system.
Parallel agents that each touched part of it broke each other. That is why
`render/` and `sky/` have exactly one owner here.

## What changed since round 0 (don't undo any of it)

- **Two quality targets, one codebase.** `ultra` is the AAA target and the
  default. `chromebook` (src/core/config.js) is a light preset for integrated
  GPUs: 0.6 render scale, no screen-space effects, 2 small cascades, 4 bots,
  no prewarm. Every visual feature you add must degrade gracefully under it:
  read `ctx.config.q`, and gate anything expensive.
- **Enemy bodies are an authored model now** (src/ai/assets/soldier.glb,
  Character Creator rig). src/ai/glbsoldier.js retargets the procedural
  25-bone rig onto it each frame. The animator, IK, ragdoll and hitboxes
  still run on the procedural skeleton, which is no longer drawn. The
  soldier's rifle is its own mesh. `?soldier=proc` shows the old body.
- **src/match/** owns the TDM loop: clock, enemy score, reinforcements and end
  of match. src/player has death and respawn. weapons has refillAll() and
  no firing while dead. Enemy rounds don't hit enemies.
- **Gameplay gate:** `node tools/bughunt.mjs --port=<yours>` plays the game
  and must still pass after your changes (`--from=N` runs part of it). It
  is slow; run it once at the end of your work, not per iteration.
- **Shipping:** `node tools/pack.mjs` builds opus-of-duty.html (ultra) and
  opus-of-duty-chromebook.html as single files that open from disk. The
  lead runs it; you just keep `npx vite build` green.

## The machine

This box has 4 CPU cores and no GPU. WebGL runs on SwiftShader, about
**14 s per frame at 1280×720** plus a **~4 min boot**. So:

- **Every capture goes through the queue:**
  `tools/snap.sh <outdir> <shot,shot> <yourPort>` for full-game shots, or
  `tools/snap.sh --raw node src/<you>/shoot.mjs ... --port=<yourPort>` for a
  subsystem preview. Never run chromium outside `tools/snap.sh`: a second
  concurrent render starves everyone.
- Use your assigned port so vite servers don't collide.
- Iterate on the cheap preview for your subsystem (`src/weapons/shoot.mjs`,
  `src/ai/shoot.mjs`, `src/materials/shoot.mjs`, `src/fx/shoot.mjs`,
  `src/ui/preview.mjs`) where one exists. Use the full-game shots to confirm.
- Batch your changes. Think hard, then capture. Don't capture after every
  one-line tweak.
- Put scratch output under `shots/<you>/`, which is gitignored.
- Keep `npx vite build` passing, and make sure a full shot still boots when
  you're done. A broken boot blocks every other agent.
- **Do not `git commit`.** The lead commits between rounds. Concurrent commits
  race on the index lock.
- Before running `pkill`, check that its pattern can't match your own shell
  command line.

## Shots (src/dev/shots.js)

`hero interior detail sunset night weapon ads muzzle combat impacts hud`.
Each has a `doc` string that says what it is judging.

## The bar

The bar is a modern Call of Duty (MW2019 → Black Ops 6) frame at the same
framing. A harsh critic reviews your work **blind**: shown only your frame, it
must decide whether the frame is a real CoD capture or an imitation, then list
every tell. After that it compares side by side against **real CoD frames in
`shots/refs/`** (see `shots/refs/README.md` for which reference suits which
shot) and says which one looks better. Look at those references yourself
before you start: they are the target. Don't copy their branding, names or
logos.

A pass means the critic can't tell, or scores the shot at 8/10 or higher, with
no frame-ruining defects. Keep going until you get there, or until you can
show a specific technical ceiling blocking you.

Lessons from the previous run:

- Measure before you "fix". One agent found the weapon wasn't untextured, just
  specular-dominated. Its diffuse term was L=26 against a shipped L=67. Read
  the pixels (`tools/analyze.mjs`, `tools/crop.mjs`) rather than guessing.
- Physically plausible values: albedo 0.02–0.9, metalness 0 or 1, and
  exposure-driven lighting instead of multipliers.
- Nothing perfectly clean, straight or repeated.

## Report

End with a short report:

- What you changed, file by file.
- Before/after capture paths.
- Remaining tells you know about.
- Anything you need from another owner.
