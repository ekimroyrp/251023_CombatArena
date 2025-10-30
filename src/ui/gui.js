import GUI from "lil-gui";

export const TYPE_OPTIONS = ["Halo", "Counter Strike 2", "Quake"];
export const CORRIDOR_OPTIONS = ["L", "Manhattan", "Bresenham", "Spiral", "Radial"];
export const SYMMETRY_OPTIONS = {
  None: "None",
  "X+": "X",
  "X-": "X_NEG",
  "Y+": "Y_POS",
  "Y-": "Y",
  "X+Y+": "XY_POS",
  "X+Y-": "XY",
  "X-Y+": "XY_NEG",
  "X-Y-": "XY_NEG_LEFT"
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

  const plansFolder = gui.addFolder("Plans");
  plansFolder
    .add(params, "type", TYPE_OPTIONS)
    .name("Layout Style")
    .onFinishChange(callbacks.onChange);
  plansFolder
    .add(params, "symmetry", SYMMETRY_OPTIONS)
    .name("Layout Symmetry")
    .onFinishChange(callbacks.onChange);
  const seedController = plansFolder
    .add(params, "seed", 1, 1000, 1)
    .name("Layout Seed")
    .onFinishChange(callbacks.onChange);
  plansFolder
    .add(params, "cellSize", 1, 8, 0.5)
    .name("Grid Cell Size")
    .onFinishChange(callbacks.onChange);
  plansFolder
    .add(params, "gridWidth", 8, 64, 1)
    .name("Grid X Amount")
    .onFinishChange(callbacks.onChange);
  plansFolder
    .add(params, "gridHeight", 8, 64, 1)
    .name("Grid Y Amount")
    .onFinishChange(callbacks.onChange);
  plansFolder
    .add(params, "floorThickness", 0.25, 10, 0.25)
    .name("Floor Thickness")
    .onFinishChange(callbacks.onChange);
  plansFolder.open();

  const roomsFolder = gui.addFolder("Rooms");
  roomsFolder
    .add(params, "roomSizeMin", 3, 24, 1)
    .name("Room Min")
    .onFinishChange(callbacks.onChange);
  roomsFolder
    .add(params, "roomSizeMax", 3, 24, 1)
    .name("Room Max")
    .onFinishChange(callbacks.onChange);
  roomsFolder
    .add(params, "roomSizeSeed", 1, 1000, 1)
    .name("Room Seed")
    .onFinishChange(callbacks.onChange);
  roomsFolder
    .add(params, "rooms", 1, 100, 1)
    .name("Room Amount")
    .onFinishChange(callbacks.onChange);
  roomsFolder.open();

  const corridorsFolder = gui.addFolder("Corridors");
  corridorsFolder
    .add(params, "corridorStyle", CORRIDOR_OPTIONS)
    .name("Corridor Type")
    .onFinishChange(callbacks.onChange);
  corridorsFolder
    .add(params, "corridorPaddingMin", 0, 10, 1)
    .name("Corridor Min")
    .onFinishChange(callbacks.onChange);
  corridorsFolder
    .add(params, "corridorPaddingMax", 0, 10, 1)
    .name("Corridor Max")
    .onFinishChange(callbacks.onChange);
  corridorsFolder
    .add(params, "corridorSeed", 0, 1000, 1)
    .name("Corridor Seed")
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
    .add(params, "platformSeed", 1, 1000, 1)
    .name("Platform Seed")
    .onFinishChange(callbacks.onChange);
  platformsFolder.open();

  const levelsFolder = gui.addFolder("Levels");
  levelsFolder
    .add(params, "wallHeight", 1, 12, 0.5)
    .name("Wall Height")
    .onFinishChange(callbacks.onChange);
  levelsFolder
    .add(params, "floors", 1, 5, 1)
    .name("Levels Amount")
    .onFinishChange(callbacks.onChange);
  levelsFolder.open();

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

  const spawnFolder = gui.addFolder("Spawn");
  spawnFolder
    .add(params, "spawnAmount", 0, 50, 1)
    .name("Spawn Amount")
    .onFinishChange(callbacks.onChange);
  spawnFolder
    .add(params, "spawnSeed", 1, 1000, 1)
    .name("Spawn Seed")
    .onFinishChange(callbacks.onChange);
  spawnFolder.open();

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
    .addColor(params, "spawnColor")
    .name("Spawn Color")
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
  const savedStates = [];
  const STATE_PLACEHOLDER = "Select State";
  let isApplyingState = false;
  const stateSelectorModel = { selectedState: STATE_PLACEHOLDER };
  const getStateOptions = () => [
    STATE_PLACEHOLDER,
    ...savedStates.map((entry) => entry.label)
  ];
  let stateSelectorController = null;
  const saveStateSnapshot = () => {
    const snapshot = JSON.parse(JSON.stringify(params));
    const label = `State ${savedStates.length + 1}`;
    savedStates.push({ label, snapshot });
    if (stateSelectorController) {
      stateSelectorController.options(getStateOptions());
      stateSelectorModel.selectedState = STATE_PLACEHOLDER;
      stateSelectorController.updateDisplay();
    }
  };
  const saveActions = {
    image: () => callbacks.onExportImage?.(),
    mesh: () => callbacks.onExport?.(),
    state: () => saveStateSnapshot()
  };
  actionFolder.add(saveActions, "image").name("Image");
  actionFolder.add(saveActions, "mesh").name("Mesh");
  actionFolder.add(saveActions, "state").name("State");
  stateSelectorController = actionFolder
    .add(stateSelectorModel, "selectedState", getStateOptions())
    .name("Saved States")
    .onChange((value) => {
      if (isApplyingState || value === STATE_PLACEHOLDER) {
        return;
      }
      const entry = savedStates.find((item) => item.label === value);
      if (!entry) {
        return;
      }
      isApplyingState = true;
      const restored = JSON.parse(JSON.stringify(entry.snapshot));
      Object.assign(params, restored);
      gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
      callbacks.onChange?.();
      stateSelectorModel.selectedState = STATE_PLACEHOLDER;
      stateSelectorController.updateDisplay();
      isApplyingState = false;
    });

  return {
    gui,
    seedController
  };
}
