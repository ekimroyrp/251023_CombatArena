# 251023_CombatArena

251023_CombatArena is a Three.js-powered level design sandbox that procedurally blocks out competitive FPS arenas. The generator carves grid-based rooms, corridors, and mezzanines using seeded parameters so you can sweep through hundreds of layouts, preview them in first-person, and export meshes for downstream art passes in minutes.

## Features
- Parametric arena generator with sliders for grid size, room density, room scale caps, platform percentage, and symmetry passes.
- Style presets (Halo, Counter-Strike 2, Quake) that dial in corridor routing, verticality, and prop density to echo iconic shooters while staying editable.
- Multi-floor support, each with its own seed, plus mezzanine sprinkling and cover placement controls for layered encounters.
- Corridor routing modes (L-shape, Manhattan walk, Bresenham) to explore different navigation vibes with a single click.
- Built-in first-person inspection mode (WASD + space + ESC) and OBJ export for quick playtests and DCC handoff.

## Getting Started
1. Install dependencies: 
pm install
2. Start the dev server: 
pm run dev
3. Visit the Vite URL (default http://localhost:5173) to open the generator
4. Build for production: 
pm run build
5. Preview the build locally: 
pm run preview

## Controls & Workflow
- **Seed & Reset:** Roll new layouts, enter exact seeds to reproduce results, or reset the generator state.
- **Arena Layout:** Adjust grid width/height, room density, room size caps, floor count, platform density, and symmetry options.
- **Routing & Props:** Choose corridor routing algorithms, tune cover percentage, and tweak spawn spacing/quantity.
- **Presets:** Load Halo / CS2 / Quake presets to start from curated parameter sets before customizing.
- **Viewing Modes:** Use orbit controls for overview or enter First Person View for WASD exploration (ESC exits).
- **Export:** Click Export in the Actions panel to download the merged OBJ blockout for further iteration.
