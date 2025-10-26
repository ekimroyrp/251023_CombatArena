import GUI from "lil-gui";

export const TYPE_OPTIONS = ["Halo", "Counter Strike 2", "Quake"];
export const CORRIDOR_OPTIONS = ["L", "Manhattan", "Bresenham"];
export const SYMMETRY_OPTIONS = ["None", "X", "Y", "XY"];

export function createControlsPanel(params, callbacks) {
  const gui = new GUI();

  const layoutFolder = gui.addFolder("Plan");
  layoutFolder
    .add(params, "type", TYPE_OPTIONS)
    .name("Type")
    .onFinishChange(callbacks.onChange);
  const seedController = layoutFolder
    .add(params, "seed", 1, 1000, 1)
    .name("Seed")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "cellSize", 2, 8, 0.5)
    .name("Cell Size")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridWidth", 8, 64, 1)
    .name("Grid Width")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridHeight", 8, 64, 1)
    .name("Grid Length")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "symmetry", SYMMETRY_OPTIONS)
    .name("Symmetry")
    .onFinishChange(callbacks.onChange);
  layoutFolder.open();

  const roomsFolder = gui.addFolder("Rooms");
  roomsFolder
    .add(params, "rooms", 4, 48, 1)
    .name("Rooms")
    .onFinishChange(callbacks.onChange);
  roomsFolder
    .add(params, "maxRoomSize", 4, 18, 1)
    .name("Max Room")
    .onFinishChange(callbacks.onChange);
  roomsFolder.open();

  const corridorsFolder = gui.addFolder("Corridors");
  corridorsFolder
    .add(params, "corridorStyle", CORRIDOR_OPTIONS)
    .name("Style")
    .onFinishChange(callbacks.onChange);
  corridorsFolder.open();

  const platformsFolder = gui.addFolder("Platforms");
  platformsFolder
    .add(params, "platforms", 0, 10, 1)
    .name("Count")
    .onFinishChange(callbacks.onChange);
  platformsFolder
    .add(params, "platformSeed", 0, 999, 1)
    .name("Seed")
    .onFinishChange(callbacks.onChange);
  platformsFolder.open();

  const elevationFolder = gui.addFolder("Elevation");
  elevationFolder
    .add(params, "wallHeight", 3, 12, 0.5)
    .name("Wall Height")
    .onFinishChange(callbacks.onChange);
  elevationFolder
    .add(params, "floors", 1, 5, 1)
    .name("Floors")
    .onFinishChange(callbacks.onChange);
  elevationFolder.open();

  const propsFolder = gui.addFolder("Props");
  propsFolder
    .add(params, "coverProbability", 0, 0.5, 0.01)
    .name("Cover Chance")
    .onFinishChange(callbacks.onChange);
  propsFolder
    .add(params, "rampProbability", 0, 0.3, 0.01)
    .name("Ramp Chance")
    .onFinishChange(callbacks.onChange);
  propsFolder.open();

  const displayFolder = gui.addFolder("Display");
  displayFolder
    .addColor(params, "floorColor")
    .name("Floor Color")
    .onFinishChange(callbacks.onChange);
  displayFolder
    .addColor(params, "wallColor")
    .name("Wall Color")
    .onFinishChange(callbacks.onChange);
  displayFolder
    .addColor(params, "platformColor")
    .name("Platform Color")
    .onFinishChange(callbacks.onChange);
  displayFolder.open();

  const actionFolder = gui.addFolder("Actions");
  actionFolder
    .add(
      {
        export: () => callbacks.onExport?.()
      },
      "export"
    )
    .name("Export");

  return {
    gui,
    seedController
  };
}
