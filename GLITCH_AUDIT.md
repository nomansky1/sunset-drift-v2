# World-Building Glitch Hardening — Stage 2 plan

User mandate: **no obstacle "bleed" / clipping / z-fighting in view while racing under or around anything — ever.** This is a permanent quality gate on all world building.

Findings triaged from a full-file audit. Verify each line ref before editing (audit line numbers may drift).

## TIER 1 — directly causes "obstacle bleeds into view" (do first)
1. **Camera collision** — chase cam (`updateCamera`) can pass *through* buildings/props on the new hairpins & tight corners → the #1 "obstacle affecting view." Fix carefully: raycast from look-target → desired cam pos against a `camColliders` set (buildings/cranes/containers only, not every mesh — perf); if blocked, pull the cam to just before the hit. Must not stutter (that would be a new glitch).
2. **Building/crane/container clearance is horizontal-only** — tall objects at the road edge clip the low cam on corners. Add a height-aware margin: bigger clearance for taller props; keep the tallest set back further from the racing line.
3. **Fog far (760) vs camera.far (3000)** — verify what actually renders between 760–3000; if distant props/backdrop pop in when the cam orbits, either pull them inside fog or fade them. Confirm the sky dome uses `fog:false` so it isn't culled at the fog boundary.

## TIER 2 — real but localized (do after Tier 1)
4. **Coast procedural-fallback palms at Y=0** on 15-amp terrain → float/sink. Snap to `terrainHeight(x,z)` like the model path does.
5. **Too-tight prop margins** — desert cacti (+2), coast palms (+2.6) can intrude on the racing line / low cam. Raise margins; add a road-clearance test to coin lateral placement.
6. **Transparency draw-order** — BR zone cylinder / explosion spheres / ghost use `depthWrite:false` and can show through solids. Zone see-through is partly intended; tighten explosion/ghost ordering only if visible.

## TIER 3 — z-fighting stack (verify visually before touching)
7. Road overlays stacked near Y≈0.07 (road 0.07 / edge 0.075 / start line 0.07 / boost pad 0.09) rely on polygonOffset. Only touch if flicker is actually visible from hood/low angle — the existing polygonOffset (-4 road) may already handle it. **Don't destabilize a working depth setup.**

## PRESERVE (good existing safeguards)
- Road `polygonOffset -4,-4` (wins depth over terrain corridor) — do NOT reduce.
- Shadow cam far = 240 (tight, no flicker).
- BR camera Y-clamp above terrain after the lerp (the underground fix) — keep; extend to prop heights.
- Inverse-square terrain blend around the road (smooth corridor).

## VERIFY method (every fix)
Multi-angle screenshots hunting specifically for bleed/clip: low hood-height cam near tall buildings, tight hairpins (cam swings wide), elevated themes (forest/snow hills), and a top-down of each rebuilt track. No fix ships without a clean before/after.
