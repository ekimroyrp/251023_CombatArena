import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "stats.js";

import { createControlsPanel } from "./ui/gui.js";
import { generateArenaLayout } from "./generation/arenaGenerator.js";
import { buildBlockoutGroup } from "./geometry/blockoutBuilder.js";
import { createGroundGrid, updateGroundGrid } from "./geometry/groundGrid.js";
import { disposeHierarchy } from "./utils/dispose.js";
import { exportBlockoutOBJ } from "./utils/exporter.js";

const DEFAULT_PARAMS = {
  seed: 1,
  type: "Halo",
  gridWidth: 32,
  gridHeight: 24,
  cellSize: 1,
  floors: 1,
  rooms: 10,
  maxRoomSize: 8,
  corridorStyle: "L",
  coverProbability: 0,
  wallHeight: 2,
  platforms: 0,
  platformSeed: 0,
  symmetry: "None",
  floorColor: "#404040",
  wallColor: "#ffffff",
  platformColor: "#787878",
  coverColor: "#ff7b00",
  backgroundColor: "#2a2833",
  gridColor: "#969696"
};

export function initApp(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6b6d6f);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(40, 40, 40);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x101018, 0.6);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(30, 50, 10);
  scene.add(keyLight);

  const stats = new Stats();
  stats.showPanel(0);
  container.appendChild(stats.dom);

  const params = { ...DEFAULT_PARAMS };
  let seedController;
  const state = {
    scene,
    renderer,
    camera,
    controls,
    stats,
    params,
    currentArena: null,
    groundGrid: createGroundGrid(params.cellSize, params.gridColor)
  };
  state.scene.add(state.groundGrid.mesh);

  const controlsPanel = createControlsPanel(params, {
    onChange: () => rebuildArena(state),
    onExport: () => {
      if (!state.currentArena) {
        return;
      }

      const filename = [
        "arena",
        params.type?.toLowerCase().replace(/\s+/g, "-") ?? "layout",
        params.seed
      ]
        .filter(Boolean)
        .join("_")
        .concat(".obj");

      exportBlockoutOBJ(state.currentArena, filename);
    }
  });
  seedController = controlsPanel.seedController;

  window.addEventListener("resize", () => onWindowResize(state));

  rebuildArena(state);
  animate(state);
}

function rebuildArena(state) {
  const layout = generateArenaLayout(state.params);
  const blockout = buildBlockoutGroup(layout, {
    floorColor: state.params.floorColor,
    wallColor: state.params.wallColor,
    platformColor: state.params.platformColor,
    coverColor: state.params.coverColor
  });
  updateGroundGrid(state.groundGrid, layout.cellSize, state.params.gridColor);
  state.scene.background.set(state.params.backgroundColor);

  if (state.currentArena) {
    disposeHierarchy(state.currentArena);
    state.scene.remove(state.currentArena);
  }

  state.currentArena = blockout;
  state.scene.add(blockout);
}

function animate(state) {
  state.stats.begin();
  state.controls.update();
  state.renderer.render(state.scene, state.camera);
  state.stats.end();
  requestAnimationFrame(() => animate(state));
}

function onWindowResize(state) {
  const { camera, renderer } = state;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
