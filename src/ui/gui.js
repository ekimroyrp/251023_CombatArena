import GUI from "lil-gui";

export const TYPE_OPTIONS = ["Halo", "Counter Strike 2", "Quake"];
export const CORRIDOR_OPTIONS = ["L", "Manhattan", "Bresenham", "Spiral", "Radial"];
export const SYMMETRY_OPTIONS = {
  None: "None",
  "X+": "X",
  Y: "Y",
  XY: "XY"
};

const GUI_FOLDER_STYLE_ID = "combat-arena-gui-folder-style";

function ensureGuiFolderStyles() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(GUI_FOLDER_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = GUI_FOLDER_STYLE_ID;
  style.textContent = `
    .lil-gui.lil-root .lil-gui:not(.lil-root) > .lil-title {
      background-color: #5a5a5a;
      color: #ffffff;
    }
    .lil-gui {
      --number-color: #ff6434;
    }
  `;
  document.head.appendChild(style);
}

export function createControlsPanel(params, callbacks) {
  ensureGuiFolderStyles();
  const gui = new GUI();

  const layoutFolder = gui.addFolder("Plan");
  layoutFolder
    .add(params, "type", TYPE_OPTIONS)
    .name("Layout Style")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "symmetry", SYMMETRY_OPTIONS)
    .name("Layout Symmetry")
    .onFinishChange(callbacks.onChange);
  const seedController = layoutFolder
    .add(params, "seed", 1, 1000, 1)
    .name("Layout Seed")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "cellSize", 1, 8, 0.5)
    .name("Grid Cell Size")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridWidth", 8, 64, 1)
    .name("Grid X Amount")
    .onFinishChange(callbacks.onChange);
  layoutFolder
    .add(params, "gridHeight", 8, 64, 1)
    .name("Grid Y Amount")
    .onFinishChange(callbacks.onChange);
  layoutFolder.open();

  const roomsFolder = gui.addFolder("Rooms");
  roomsFolder
    .add(params, "rooms", 1, 100, 1)
    .name("Room Amount")
    .onFinishChange(callbacks.onChange);
  roomsFolder
    .add(params, "maxRoomSize", 1, 100, 1)
    .name("Room Size")
    .onFinishChange(callbacks.onChange);
  roomsFolder.open();

  const corridorsFolder = gui.addFolder("Corridors");
  corridorsFolder
    .add(params, "corridorStyle", CORRIDOR_OPTIONS)
    .name("Corridor Type")
    .onFinishChange(callbacks.onChange);
  corridorsFolder.open();

  const platformsFolder = gui.addFolder("Platforms");
  platformsFolder
    .add(params, "platforms", 0, 10, 1)
    .name("Platform Amount")
    .onFinishChange(callbacks.onChange);
  platformsFolder
    .add(params, "platformThickness", 0.25, 10, 0.25)
    .name("Platform Thickness")
    .onFinishChange(callbacks.onChange);
  platformsFolder
    .add(params, "platformSeed", 0, 999, 1)
    .name("Platform Seed")
    .onFinishChange(callbacks.onChange);
  platformsFolder.open();

  const elevationFolder = gui.addFolder("Elevation");
  elevationFolder
    .add(params, "wallHeight", 1, 12, 0.5)
    .name("Wall Height")
    .onFinishChange(callbacks.onChange);
  elevationFolder
    .add(params, "floors", 1, 5, 1)
    .name("Floor Amount")
    .onFinishChange(callbacks.onChange);
  elevationFolder.open();

  const propsFolder = gui.addFolder("Cover");
  propsFolder
    .add(params, "coverProbability", 0, 50, 1)
    .name("Cover Percentage")
    .onFinishChange(callbacks.onChange);
  propsFolder
    .add(params, "coverSeed", 1, 1000, 1)
    .name("Cover Seed")
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
  displayFolder
    .addColor(params, "coverColor")
    .name("Cover Color")
    .onFinishChange(callbacks.onChange);
  displayFolder
    .addColor(params, "backgroundColor")
    .name("Background Color")
    .onFinishChange(callbacks.onChange);
  displayFolder
    .addColor(params, "gridColor")
    .name("Grid Color")
    .onFinishChange(callbacks.onChange);
  displayFolder.open();

  const actionFolder = gui.addFolder("Save");
  actionFolder
    .add(
      {
        export: () => callbacks.onExport?.()
      },
      "export"
    )
    .name("Mesh");

  return {
    gui,
    seedController
  };
}
