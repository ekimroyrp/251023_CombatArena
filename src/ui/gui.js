import GUI from "lil-gui";

export const CORRIDOR_OPTIONS = ["L", "Manhattan", "Bresenham"];

export function createControlsPanel(params, callbacks) {
  const gui = new GUI();

  const layoutFolder = gui.addFolder("Layout");
  const seedController = layoutFolder
    .add(params, "seed")
    .name("Seed")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridWidth", 8, 64, 1)
    .name("Grid Width")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridHeight", 8, 64, 1)
    .name("Grid Height")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "cellSize", 2, 8, 0.5)
    .name("Cell Size")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "rooms", 4, 48, 1)
    .name("Rooms")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "maxRoomSize", 4, 18, 1)
    .name("Max Room")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "corridorStyle", CORRIDOR_OPTIONS)
    .name("Corridor")
    .onFinishChange(callbacks.onChange);
  layoutFolder.open();

  const propsFolder = gui.addFolder("Props");
  propsFolder
    .add(params, "coverProbability", 0, 0.5, 0.01)
    .name("Cover Chance")
    .onFinishChange(callbacks.onChange);
  propsFolder
    .add(params, "rampProbability", 0, 0.3, 0.01)
    .name("Ramp Chance")
    .onFinishChange(callbacks.onChange);
  propsFolder
    .add(params, "wallHeight", 3, 12, 0.5)
    .name("Wall Height")
    .onFinishChange(callbacks.onChange);
  propsFolder.open();

  const actionFolder = gui.addFolder("Actions");
  actionFolder
    .add(
      {
        regenerate: () => callbacks.onRegenerate?.()
      },
      "regenerate"
    )
    .name("Regenerate");
  actionFolder
    .add(
      {
        rollSeed: () => callbacks.onRollSeed?.()
      },
      "rollSeed"
    )
    .name("Roll Seed");

  return {
    gui,
    seedController
  };
}
