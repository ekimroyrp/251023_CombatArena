# FPS Blockout Arena Generator

Procedural FPS arena blockout generator built with Three.js. The tool carves a grid-based network of rooms and corridors, then merges the resulting blockout meshes for fast iteration on level layouts.

## Features
- Adjustable grid dimensions, room density, and room size caps for shaping the arena.
- Multiple corridor routing modes (L-shape, Manhattan walk, Bresenham line) to experiment with different flow patterns.
- Seeded random generation so layouts can be reproduced or rolled at will.
- Cover and ramp prop probabilities to rough in gameplay elements.
- Merged floor, wall, cover, and ramp meshes to keep draw calls low while iterating.

## Scripts
- `npm run dev` – start Vite with hot reload.
- `npm run build` – create a production build.
- `npm run preview` – serve the production build locally.

## Getting Started
1. Install dependencies once: `npm install`
2. Launch the playground: `npm run dev`
3. Use the on-screen GUI to tweak seed, grid size, corridors, and prop spawn rates. Press **Roll Seed** to quickly try new layouts with the current settings.

When ready to explore alternative corridor carving approaches, open `src/generation/corridors.js` to add additional strategies (e.g., A*).
