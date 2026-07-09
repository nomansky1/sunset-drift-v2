# Global Drift — Master Build Prompt v2 (phased)

Act as the lead technical artist + gameplay engineer on **Global Drift**
(`C:\Users\defaultuser0\Downloads\sunset-drift-v2`, Three.js, headed to Steam, phones are the
primary test device). Execute the phases below IN ORDER, one verified deploy per phase step.
Never regress: the matte-road rule, the golden-frame gates (`tools/golden-capture.js`,
goldens in `Downloads/sunset-drift-v2-goldens/`), the physics fingerprint, and zero console
errors apply to every phase. Use DEVCAM for all verification and marketing captures.
Optimize scope per step so a single Opus 4.8 session can finish and verify it.

## Ground rules (non-negotiable)
1. **Map data is OpenStreetMap, never Google** — Google's ToS poisons a sold Steam game.
   "Match the real world" = OSM footprints/roads/parks/landmarks, styled low-poly, credited.
2. **Every imported model gets a license check** (commercial use, no attribution traps) noted
   in CREDITS.md before it ships. Rodin/Fast3D pulls: verify the license label on the page.
3. **Mobile first**: every phase re-checks a phone-tier profile (lowQuality/isTouch paths,
   draw-call budget ≤ baseline ×1.10, no added texture memory spikes).
4. Physics/AI feel stays identical unless the phase explicitly changes it.
5. Blender headless (`--background --python`) for all model prep; never hand-edit GLBs.

## Phase 0 — Finish the engine ladder (in flight)
- 0.1 Modern-lighting retune: `useLegacyLights=false` + ×π light rescale, gate vs r155 goldens, ship.
- 0.2 r16x bundle checkpoint (rebuild vendor bundle, fix any vUv-class shader-chunk breaks), re-freeze goldens.
- 0.3 Visual uplift: better bloom, SSAO tier-gated, TAA/SMAA desktop. This is the base "realistic look" layer.

## Phase 1 — Mobile look & exposure fix
- 1.1 Fix overexposure on phones: per-tier tone-mapping/exposure audit (the bright themes clip on
  mobile Chrome); verify on a real phone profile (DevTools emulation + owner's phone sign-off).
- 1.2 Realistic drift smoke: volumetric-looking sprite puffs that hug the tires, camera-aware so
  they NEVER white-out the player's view; same system for AI racers (smaller budget).
- 1.3 Exhaust pass on every model: verify tip meshes align per car; add engine-idle behavior
  (subtle body tremble + faint exhaust wisps when stationary) and real smoke puffs on
  throttle blips/launches. Particles budgeted for mobile.

## Phase 2 — Car roster upgrade (Rodin / Fast3D / Downloads)
- 2.1 Inventory: list current fleet slots; mark which models were never replaced (Kenney-era:
  karts, firetruck, ambulance) and which pack cars look weakest.
- 2.2 Pull free, commercially-licensed racing car models from the owner's accounts at
  hyper3d.ai/workspace/rodin and fast3d.io (Chrome is logged in), plus scan
  `C:\Users\defaultuser0\Downloads` for already-downloaded commercial-use models.
- 2.3 Blender pipeline per model: normalize scale/origin (wheels rest y=0, centred), name
  wheels `wheel_front/rear_L/R`, clamp metalness ≤0.45, bake to game budgets (≤15k tris/car),
  export Draco GLB with NEW filenames. Wire into CARS with correct handling stats.
- 2.4 Verify per car: DEVCAM orbit + drive test (wheels spin/steer, lean rigid, paint shop +
  upgrade kit + tire upgrade all attach correctly).
- 2.5 **Remove trucks from the RACE roster** (HAULER etc. out of CARS/shop) but keep truck
  models as world/NPC traffic props.

## Phase 3 — Damage, repair & destruction core
- 3.1 Panel segmentation (Blender headless): split every car body into panels (hood, doors,
  bumpers, roof, trunk) exported as sub-meshes so ALL models can shed pieces. Keep a joined
  low-cost version for AI far-LOD if needed.
- 3.2 Progressive visible damage: collisions mark the nearest panel (dent tint/normal jitter →
  loose wobble → panel flies off with physics + spark/debris particles). Speed- and
  angle-scaled. Works vs barriers AND car-to-car.
- 3.3 Repair pickups: 3D wrench/toolbox/gearbox props on track; driving through one plays a
  quick self-heal effect (panels re-attach, sparks reverse). Spawn tuning per mode; ALWAYS on
  in Battle Royale.
- 3.4 Never fully bricked: damage floor keeps the car drivable; full deterioration only in BR.

## Phase 4 — Battle Royale: open-world combat on real streets
- 4.1 Arena = real-street districts (OSM), no racetrack barriers; free roam on the road grid
  of famous cities (start: New York, Miami, San Juan). Collision from building footprints.
- 4.2 AI combatants actively hunt the player (pursuit + strafing lines + weapon use).
- 4.3 Destructible environment: dumpsters, cones, benches, stalls, parked cars → real
  explosion effects (flash, fireball sprite, smoke column, debris chunks, decal scorch).
  Rockets and gatling both interact; per-object HP.
- 4.4 Weapon kit v2 (PBR, molded per car like the upgrade kits): gatling (new muzzle-flash,
  tracer, shell-eject particles), + logically mounted additions (side rocket pods, rear mine
  dropper, front ram blade), armor plating cosmetic tiers. High-detail materials, clamped for
  mobile.

## Phase 5 — Real-city racing everywhere
- 5.1 Extend the OSM pipeline: for each famous-city track, pull roads + parks + landmark
  footprints (not just building boxes); landmark heroes get custom low-poly models (Blender +
  Downloads/asset packs) — e.g., statue, bridge, arch per city.
- 5.2 Buildable street circuits: generate the racing loop FROM the real road graph (closed
  loops on actual streets, scaled to the game world), with per-city PBR material sets
  (asphalt wear, sidewalks, signage) and collision that matches every environment.
- 5.3 Free-roam mode groundwork: drive any major road in the district outside of races.
- 5.4 Verify per city with DEVCAM flyovers vs reference imagery; keep mobile block-LOD swaps.

## Phase 6 — HUD & cockpit polish
- 6.1 Modern HUD icon/button set (consistent style, themed to the game's neon identity),
  replacing emoji/system glyphs everywhere (menu, race, garage, BR).
- 6.2 Fix cockpit view: on-screen touch buttons currently disappear — ensure full HUD renders
  above the interior in every camera view.

## Per-phase definition of done
lint (`node --check` all scripts) → local serve → feature-specific numeric/physics checks →
DEVCAM screenshots (before/after) → golden gates where rendering changed → deploy → live
poll → owner-visible summary with screenshots. Marketing clips (DEVCAM.seq) captured for any
visually striking phase.
