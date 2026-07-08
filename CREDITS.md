# Sunset Drift — Asset Credits & Licenses

All third-party assets used here are licensed for commercial use.

- **Car models**:
  - "Car-Demo" (the DRIFTER) by **Manik Sharma**, MIT License (use/modify/sell permitted).
  - Fleet + extra vehicles (the 15 GLB cars incl. KART, HAULER, FIRETRUCK, AMBULANCE) from the **Kenney "Car Kit"**,
    CC0 — generic/original low-poly designs with modular rigged wheels, NOT modeled after any real manufacturer
    (no branded/trademarked vehicles are used; the game is sold commercially).
  All car models were optimized for web (textures resized + WebP, geometry pruned) via gltf-transform.
- **Sky / reflection HDRI** — "Venice Sunset" from **Poly Haven**, CC0 (public domain).
- **Road textures** — lane markings from the Godot "Road Generator" addon (TheDuckCow, MIT);
  asphalt surface-normal from **ambientCG** "Ground037", CC0.
- **Trees, rocks, cactus, container** — low-poly models from **poly.pizza**, all **CC0 (public domain)**:
  - Pine Tree, Tree (broadleaf), Palm Tree, Cactus, Shipping Container by **Quaternius** — CC0.
  - Rock ("Rock Flat Grass") and "Rock Formation" (desert) by **Kenney** — CC0.
  Quaternius and Kenney release their entire catalogs as CC0; each model was license-verified,
  web-optimized (WebP textures, geometry intact) via gltf-transform, and instanced onto the terrain.
- **Car audio** — all **CC0 (public domain)**:
  - Engine idle loop — "Car engine idle 2" by **Iridiuss** (Freesound, via RAPTOR15), CC0.
  - Engine RPM loops (mid/high) — "Racing Car Engine Sound Loops" by **domasx2** (OpenGameArt), CC0.
  - Tire skid — "Tires Squeaking" by **RutgerMuller** (Freesound), CC0.
  - Nitro/boost purge — "Air Hiss" by **Jofae** (Freesound), CC0.
  The engine layers are crossfaded by RPM and pitch-shifted at runtime.
- **Engine** — **Three.js** (MIT).

Everything else — the city (buildings, storefronts, signage, billboards, water towers,
streetlights), the road geometry, UI, particles, and audio — is generated procedurally in code.

Branded/copyrighted vehicle models are intentionally NOT used, since this game is distributed commercially.

- **Low-poly city district** (infield downtown on the city/docks tracks) — "Lowpoly City Free Pack" by **Antonmoek** (TurboSquid free license; generic/non-branded stylized buildings, not a real city). Converted OBJ→glTF via Blender, merged + quantized + WebP-textured for web.

- **Real-city districts** (Times Square, Shibuya, South Beach, Champs-Élysées, Piccadilly, Sheikh Zayed Rd,
  Tverskaya, Fort Mumbai, Copacabana, Berlin Mitte) — building footprints & heights from **OpenStreetMap**,
  © OpenStreetMap contributors, licensed **ODbL** (openstreetmap.org/copyright). Geometry generated in Blender
  from the data; low-poly stylization ours.
