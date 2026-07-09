# Global Drift — Master Roadmap (owner brief, restructured 2026-07-09)

Act as the lead technical artist + gameplay engineer on **Global Drift**
(single-page Three.js racer at `index.html`, deployed on GitHub Pages, headed to Steam,
phones-first today). Execute the phases below IN ORDER, one verified deploy per stage,
using the established rituals — they are non-negotiable:

- **Verify before claiming done**: lint (9/9 inline scripts + node --check on game-core.js/spline.js),
  local serve :8099, DEVCAM screenshots of the actual change, golden-frame gates
  (`tools/golden-capture.js` vs `../sunset-drift-v2-goldens/<current>` — goldens first, `__phys()` after,
  complete input objects), zero console errors, deploy, poll live BUILD, re-verify live.
- **Owner art rules**: roads are MATTE (no gloss ever); keep the cars' current identity; matte-black
  neutral asphalt with crisp markings; cinematic per-environment grade.
- **Mobile is the primary device.** Every phase ends with a phone-budget check
  (draw calls ≤ baseline ×1.10, no added per-frame allocations, LITE fallbacks on isTouch/lowQuality).
- Licenses: only commercially-usable assets; credit in CREDITS.md. OSM (© OpenStreetMap, ODbL) is the
  ONLY map source — never Google data.

## Phase A — finish the engine ladder (in flight)
1. Modern-lighting retune on r155: flip `useLegacyLights` off, ×π all light intensities
   (sites: buildLights hemi/ambient/sun/fill, night streetlight SpotLight ~3919, rocket PointLight ~4776,
   generic PointLight helper ~5220, globe preview lights ~6305), match goldens/r155, re-freeze, deploy.
   (`ColorManagement.enabled=false` stays — supported in r16x, preserves colors.)
2. r16x bundle checkpoint (rebuild vendor bundle, gates, expect more vUv-class onBeforeCompile breaks).
3. **Mobile exposure fix (owner: "environment over-exposed by the sun on phones")**: per-theme
   `toneMappingExposure` currently 0.74 bright/0.80 warm/0.98 dusk — audit on-device look via DEVCAM
   at isTouch pixel ratios; add a mobile-specific exposure/bloom trim; verify on low-end Chrome profile
   (renderScale path). Goal: realistic, not washed out, even on weak phones.

## Phase B — roster refresh (new cars + truck retirement)
1. **Retire HAULER from the racing roster** (keep `truck.glb` for world NPC/parked/docks use).
   CARS entries are index-keyed by saves (ownedCars/paintStyles/upgrades) — retire via a
   `retired:true` flag filtered from shop/select/grid, never by array removal. If selectedCar is
   retired on load → fall back to 0. FIRETRUCK/AMBULANCE/karts get replaced in B2, then retired the same way.
2. **Pull new racing cars from Hyper3D Rodin (hyper3d.ai/workspace/rodin) and fast3d.io** — accounts
   are logged in on Chrome. Only FREE, commercial-use listed models. Browse via claude-in-chrome,
   download GLB/FBX, then run the established Blender headless pipeline
   (gd-blender/phase_wheels_all.py pattern: separate wheels → axle-centred wheel_front/rear_L/R naming →
   assembly centred at origin → NEW filenames → Draco GLB). Clamp metalness ≤0.45. One car shipped +
   verified in a real race (drift + tire upgrade) before the next.
3. **Also inventory `C:\Users\defaultuser0\Downloads` for free commercial models** the owner already
   downloaded (cars, props, weapons) and fold usable ones into the same pipeline.
4. **Alignment audit after each roster change**: tires/body/upgrade parts on ALL models
   (pivot-group wheels, rig.packCar gate, kit raycast mounts) — numeric wheel-drift assert + orbit shots.

## Phase C — damage, repair & exhaust life
1. **Panel-split damage on every car**: pre-split each car GLB into panels (hood/doors/bumpers/wing)
   in the Blender pipeline (loose-part separation + named panel nodes). At collision impulses above
   thresholds: visibly deform/detach panels (hood dents first, then pieces fly with debris physics +
   spark/paint-chip particles). Progressive damage state per car, capped before "fully deteriorated".
   Works while racing AND in Battle Royale, for player + AI.
2. **Repair pickups**: 3D wrench / toolbox / gearbox pickups on track & BR map; driving through one
   plays a heal effect and restores panels progressively (self-healing animation — panels fly back).
3. **Exhaust pass**: review every model's exhaust mesh placement; idle mode (car stationary/not
   throttling → subtle idle puffs + slight body vibration); real exhaust smoke particles when
   accelerating (small, dark, fast-fading; LITE on mobile).
4. **Drift smoke realism**: volumetric-looking soft white/grey puffs from the rear tires that stay LOW
   and behind the car — must never blind the chase camera; same effect on AI cars (cheap instanced
   sprites, distance-culled).

## Phase D — real-world places (OSM everywhere)
1. Extend the OSM district system to **drivable real-street environments**: for NYC, Miami,
   San Juan (PR) first — fetch the major-road graph (Overpass, kumi mirror, User-Agent), build
   low-poly PBR-textured streets + sidewalks + parks + landmark buildings in the Blender headless
   pipeline (per-city palette, ≤ web budgets, Draco). Landmarks as recognizable low-poly silhouettes.
2. **Buildable tracks around famous places**: generate closed street-circuit ctrl points from the OSM
   road graph (excise-self-loop rules; legs opened) so racing tracks ARE the real streets, matched to
   the real layout as closely as possible. Use DEVCAM flyovers vs reference maps for verification.
3. **Per-environment collision assets**: camColliders + soft-wall data generated from the same OSM
   geometry so every drivable street collides correctly, with its own PBR ground/road materials.

## Phase E — Battle Royale on real streets
1. BR arena = any Phase-D city, **no racetrack barriers** — free roaming on the real road network.
2. AI hunters: BR AI drives the open streets (graph navigation) and actively hunts the player with
   gatling + rockets; player can destroy AI cars (panel-split + explosion) and world objects
   (dumpsters, cones, stalls → real explosion + shatter debris + fire/smoke particles).
3. **Weapon/armor kits (PBR, molded per car)**: designed armor plating + logically-mounted weapons
   alongside the gatling (e.g. hood gatling, roof rocket pod, side exhaust-flamer slot) — high-detail
   PBR materials, fitted to each car's dims via the kit-mount raycast system. Gatling muzzle-flash +
   tracer + shell-eject special effects.

## Phase F — presentation
1. **Modern HUD icon/button set** (SVG/canvas, themed to the neon-cinematic brand) replacing emoji
   icons; consistent across menu/race/BR.
2. **Cockpit-view HUD fix**: the on-screen touch buttons currently disappear in cockpit view — they
   must stay on top (DOM z-order/visibility bug).
3. Marketing capture batch per phase (DEVCAM stills + seq clips) for Steam page b-roll.

## Sequencing rules
- One stage per loop iteration, always shippable, gates green, memory notes per landmine found.
- Phases B1, A3, F2 are quick wins — interleave them early.
- Heavy asset stages (B2, D1, E) run as multiple iterations each; never block deploys on them.
