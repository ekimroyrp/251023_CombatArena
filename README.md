# FPS Blockout Arena Generator

Procedural FPS arena blockout generator built with Three.js. The tool carves a grid-based network of rooms and corridors, then merges the resulting blockout meshes for fast iteration on level layouts.

## Features
- Adjustable grid dimensions, room density, and room size caps for shaping the arena.
- Style presets (Halo, Counter Strike 2, Quake) that bias room density, verticality, ramps, and corridor flow to echo those franchises while still honoring your sliders.
- Stackable floor levels with a dedicated slider; each level is generated from its own seeded layout so upper decks can fully or partially cover the floor below.
- Per-floor platform slider to sprinkle mid-height mezzanines that hug room boundaries at half wall height.
- Multiple corridor routing modes (L-shape, Manhattan walk, Bresenham line) to experiment with different flow patterns.
- Seeded random generation so layouts can be reproduced or rolled at will.
- Cover probability slider plus ramp probability to control inter-floor connectors.
- One-click OBJ export from the Actions panel for bringing blockouts into DCC tools or other engines.
- Merged floor, wall, cover, and ramp meshes to keep draw calls low while iterating.

## Scripts
- `npm run dev` - start Vite with hot reload.
- `npm run build` - create a production build.
- `npm run preview` - serve the production build locally.

## Getting Started
1. Install dependencies once: `npm install`
2. Launch the playground: `npm run dev`
3. Use the on-screen GUI to pick an arena **Type**, tweak seed, grid size, floor count, platforms, corridors, and prop spawn rates. Press **Roll Seed** to quickly try new layouts with the current settings.
4. Once happy with a layout press **Export** in the Actions panel to download the merged blockout mesh.

When ready to explore alternative corridor carving approaches, open `src/generation/corridors.js` to add additional strategies (e.g., A*).
