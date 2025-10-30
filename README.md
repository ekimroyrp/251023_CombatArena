# FPS Blockout Arena Generator

Procedural FPS arena blockout generator built with Three.js. The tool carves a grid-based network of rooms and corridors, then merges the resulting blockout meshes for fast iteration on level layouts.

## Features
- Adjustable grid dimensions, room density, and room size caps for shaping the arena.
- Style presets (Halo, Counter Strike 2, Quake) that bias room density, verticality and corridor flow to echo those franchises while still honoring your sliders.
- Stackable floor levels with a dedicated slider; each level is generated from its own seeded layout so upper decks can fully or partially cover the floor below.
- Per-floor platform slider (with dedicated seed) to sprinkle mid-height mezzanines that hug room boundaries at half wall height.
- Multiple corridor routing modes (L-shape, Manhattan walk, Bresenham line) to experiment with different flow patterns.
- Seeded random generation so layouts can be reproduced or rolled at will.
- Cover percentage slider (with seed) to rough in inter-floor connectors.
- Spawn placement slider that drops neon-green spawn markers (priority over cover) while keeping them spaced apart.
- One-click OBJ export from the Actions panel for bringing blockouts into DCC tools or other engines.
- Merged floor, wall, cover, and platform meshes to keep draw calls low while iterating.
- Houdini-style infinite ground grid that respects the cell size and fades with distance for orientation.
- Optional X/Y/XY symmetry passes that clone the finished layout (floors, props, platforms) without seams.

## Scripts
- `npm run dev` - start Vite with hot reload.
- `npm run build` - create a production build.
- `npm run preview` - serve the production build locally.

## Getting Started
1. Install dependencies once: `npm install`
2. Launch the playground: `npm run dev`
3. Use the on-screen GUI to pick an arena **Type**, adjust the seed slider (1–1000), tweak grid size, floor count, platforms, platform seed, symmetry, corridors, and prop spawn rates to explore layouts.
4. Once happy with a layout press **Export** in the Actions panel to download the merged blockout mesh.

When ready to explore alternative corridor carving approaches, open `src/generation/corridors.js` to add additional strategies (e.g., A*).
