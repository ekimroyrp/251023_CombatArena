import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
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
  gridWidth: 30,
  gridHeight: 38,
  cellSize: 2,
  floors: 1,
  rooms: 10,
  roomSizeMin: 4,
  roomSizeMax: 8,
  roomSizeSeed: 1,
  maxRoomSize: 8,
  roomHighlight: false,
  elevationMin: 0,
  elevationMax: 0,
  elevationChance: 100,
  elevationSeed: 1,
  corridorStyle: "L",
  corridorPaddingMin: 1,
  corridorPaddingMax: 1,
  corridorSeed: 1,
  coverProbability: 0,
  wallHeight: 6,
  wallThickness: 0.5,
  wallHide: false,
  floorThickness: 0.25,
  platforms: 0,
  platformHeight: 3,
  platformSeed: 1,
  platformThickness: 0.25,
  spawnAmount: 0,
  spawnSeed: 1,
  spawnColor: "#59ff00",
  symmetry: "None",
  floorColor: "#909090",
  wallColor: "#ffffff",
  platformColor: "#89d7e1",
  coverColor: "#ff7b00",
  coverSeed: 1,
  backgroundColor: "#2a2833",
  gridColor: "#969696"
};

const FIRST_PERSON_CAMERA_HEIGHT = 1;

export function initApp(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = -1;
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

  const ambientLight = new THREE.AmbientLight(0x2a2833, 0.35);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x101018, 0.45);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xf5f2e8, 1.2);
  keyLight.position.set(60, 80, 30);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 5;
  keyLight.shadow.camera.far = 200;
  const shadowVolume = 120;
  keyLight.shadow.camera.left = -shadowVolume;
  keyLight.shadow.camera.right = shadowVolume;
  keyLight.shadow.camera.top = shadowVolume;
  keyLight.shadow.camera.bottom = -shadowVolume;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  keyLight.target.position.set(0, 0, 0);
  scene.add(keyLight);
  scene.add(keyLight.target);

  const rimLight = new THREE.DirectionalLight(0x6caeff, 0.25);
  rimLight.position.set(-50, 40, -60);
  scene.add(rimLight);

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
    clock: new THREE.Clock(),
    firstPerson: null,
    orbitSnapshot: null,
    gui: null,
    currentArena: null,
    groundGrid: createGroundGrid(params.cellSize, params.gridColor)
  };
  state.scene.add(state.groundGrid.mesh);
  setupFirstPerson(state);

  const controlsPanel = createControlsPanel(params, {
    onChange: () => rebuildArena(state),
    onExportImage: () => exportViewportImage(state),
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
    },
    onEnterFirstPerson: () => enterFirstPerson(state)
  });
  seedController = controlsPanel.seedController;
  state.gui = controlsPanel.gui;

  window.addEventListener("resize", () => onWindowResize(state));

  rebuildArena(state);
  animate(state);
}

function rebuildArena(state) {
  const layout = generateArenaLayout(state.params);
  state.layout = layout;
  const blockout = buildBlockoutGroup(layout, {
    floorColor: state.params.floorColor,
    wallColor: state.params.wallColor,
    wallHide: state.params.wallHide,
    platformColor: state.params.platformColor,
    coverColor: state.params.coverColor,
    spawnColor: state.params.spawnColor,
    roomHighlight: state.params.roomHighlight
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
  requestAnimationFrame(() => animate(state));
  const delta = state.clock.getDelta();
  state.stats.begin();
  if (state.firstPerson?.isActive) {
    updateFirstPerson(state, delta);
  } else {
    state.controls.update();
  }
  state.renderer.render(state.scene, state.camera);
  state.stats.end();
}

function onWindowResize(state) {
  const { camera, renderer } = state;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function exportViewportImage(state) {
  const { renderer, scene, camera, params } = state;
  renderer.render(scene, camera);

  const canvas = renderer.domElement;
  const filename = [
    "arena",
    params.type?.toLowerCase().replace(/\s+/g, "-") ?? "layout",
    params.seed,
    new Date().toISOString().replace(/[:.]/g, "-")
  ]
    .filter(Boolean)
    .join("_")
    .concat(".png");

  const triggerDownload = (blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFromDataUrl = () => {
    const dataUrl = canvas.toDataURL("image/png");
    const byteString = atob(dataUrl.split(",")[1]);
    const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i += 1) {
      ia[i] = byteString.charCodeAt(i);
    }
    triggerDownload(new Blob([ab], { type: mimeString }));
  };

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob);
      } else {
        downloadFromDataUrl();
      }
    }, "image/png");
  } else {
    downloadFromDataUrl();
  }
}

function setupFirstPerson(state) {
  const controls = new PointerLockControls(state.camera, state.renderer.domElement);

  const firstPerson = {
    controls,
    isActive: false,
    awaitingLock: false,
    pendingSpawn: null,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    canJump: true,
    cameraHeight: FIRST_PERSON_CAMERA_HEIGHT,
    baseHeight: 0,
    acceleration: 80,
    damping: 12,
    gravity: 15,
    jumpVelocity: 7
  };

  const movementKeys = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space"
  ]);

  const handleKeyDown = (event) => {
    if (firstPerson.awaitingLock || firstPerson.isActive) {
      if (movementKeys.has(event.code)) {
        event.preventDefault();
      }
    }
    if (!firstPerson.isActive) {
      return;
    }
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        firstPerson.moveForward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        firstPerson.moveLeft = true;
        break;
      case "ArrowDown":
      case "KeyS":
        firstPerson.moveBackward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        firstPerson.moveRight = true;
        break;
      case "Space":
        if (firstPerson.canJump) {
          firstPerson.velocity.y = firstPerson.jumpVelocity;
          firstPerson.canJump = false;
        }
        break;
      case "Escape":
        exitFirstPerson(state);
        break;
      default:
        break;
    }
  };

  const handleKeyUp = (event) => {
    if (!firstPerson.isActive) {
      return;
    }
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        firstPerson.moveForward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        firstPerson.moveLeft = false;
        break;
      case "ArrowDown":
      case "KeyS":
        firstPerson.moveBackward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        firstPerson.moveRight = false;
        break;
      default:
        break;
    }
  };

  const handleLock = () => {
    const spawn = firstPerson.pendingSpawn ?? getRandomWalkablePosition(state.layout);
    firstPerson.pendingSpawn = null;
    firstPerson.awaitingLock = false;

    if (!spawn) {
      exitFirstPerson(state);
      return;
    }

    firstPerson.isActive = true;
    firstPerson.moveForward = false;
    firstPerson.moveBackward = false;
    firstPerson.moveLeft = false;
    firstPerson.moveRight = false;
    firstPerson.velocity.set(0, 0, 0);
    firstPerson.canJump = true;
    firstPerson.baseHeight = spawn.groundHeight;

    const camera = firstPerson.controls.object;
    camera.position.copy(spawn.position);

    state.controls.enabled = false;
    firstPerson.controls.enabled = true;

    if (state.gui) {
      state.gui.domElement.style.pointerEvents = "none";
    }

    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    queueMicrotask(() => {
      if (state.renderer.domElement && typeof state.renderer.domElement.focus === "function") {
        state.renderer.domElement.focus();
      }
    });
  };

  const handleUnlock = () => {
    if (firstPerson.isActive || firstPerson.awaitingLock) {
      exitFirstPerson(state);
    }
  };

  controls.addEventListener("lock", handleLock);
  controls.addEventListener("unlock", handleUnlock);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  firstPerson.cleanup = () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    controls.removeEventListener("lock", handleLock);
    controls.removeEventListener("unlock", handleUnlock);
  };

  state.firstPerson = firstPerson;
}

function enterFirstPerson(state) {
  if (!state.layout || !state.firstPerson) {
    console.warn("First-person view requires a generated layout.");
    return;
  }
  if (state.firstPerson.isActive || state.firstPerson.awaitingLock) {
    return;
  }

  const spawn = getRandomWalkablePosition(state.layout);
  if (!spawn) {
    console.warn("Unable to find a suitable position for first-person view.");
    return;
  }

  state.orbitSnapshot = {
    position: state.camera.position.clone(),
    target: state.controls.target.clone()
  };

  const firstPerson = state.firstPerson;
  firstPerson.pendingSpawn = spawn;
  firstPerson.awaitingLock = true;
  firstPerson.velocity.set(0, 0, 0);
  firstPerson.canJump = true;

  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  if (state.gui) {
    state.gui.domElement.style.pointerEvents = "none";
  }

  firstPerson.controls.lock();
}

function exitFirstPerson(state) {
  const firstPerson = state.firstPerson;
  if (!firstPerson) {
    return;
  }

  const wasLocked = firstPerson.controls.isLocked;
  const wasEngaged = firstPerson.isActive || firstPerson.awaitingLock;

  firstPerson.isActive = false;
  firstPerson.awaitingLock = false;
  firstPerson.pendingSpawn = null;
  firstPerson.moveForward = false;
  firstPerson.moveBackward = false;
  firstPerson.moveLeft = false;
  firstPerson.moveRight = false;
  firstPerson.velocity.set(0, 0, 0);
  firstPerson.canJump = true;

  if (wasLocked) {
    firstPerson.controls.unlock();
  }

  state.controls.enabled = true;
  if (state.gui) {
    state.gui.domElement.style.pointerEvents = "";
  }
  if (document.activeElement === state.renderer.domElement) {
    state.renderer.domElement.blur();
  }

  if (!wasEngaged) {
    return;
  }

  if (state.orbitSnapshot) {
    state.camera.position.copy(state.orbitSnapshot.position);
    state.controls.target.copy(state.orbitSnapshot.target);
  }
  state.controls.update();
}

function updateFirstPerson(state, delta) {
  const firstPerson = state.firstPerson;
  if (!firstPerson || !firstPerson.isActive) {
    return;
  }

  if (!firstPerson.controls.isLocked) {
    exitFirstPerson(state);
    return;
  }

  firstPerson.velocity.x -= firstPerson.velocity.x * firstPerson.damping * delta;
  firstPerson.velocity.z -= firstPerson.velocity.z * firstPerson.damping * delta;

  firstPerson.direction.z =
    Number(firstPerson.moveForward) - Number(firstPerson.moveBackward);
  firstPerson.direction.x =
    Number(firstPerson.moveRight) - Number(firstPerson.moveLeft);
  firstPerson.direction.normalize();

  if (firstPerson.moveForward || firstPerson.moveBackward) {
    firstPerson.velocity.z -= firstPerson.direction.z * firstPerson.acceleration * delta;
  }
  if (firstPerson.moveLeft || firstPerson.moveRight) {
    firstPerson.velocity.x -= firstPerson.direction.x * firstPerson.acceleration * delta;
  }

  firstPerson.velocity.y -= firstPerson.gravity * delta;

  firstPerson.controls.moveRight(-firstPerson.velocity.x * delta);
  firstPerson.controls.moveForward(-firstPerson.velocity.z * delta);

  const fpCamera = firstPerson.controls.object;
  fpCamera.position.y += firstPerson.velocity.y * delta;

  const groundHeight = getGroundHeightAtPosition(
    state.layout,
    fpCamera.position.x,
    fpCamera.position.z,
    fpCamera.position.y
  );
  if (groundHeight !== null) {
    firstPerson.baseHeight = groundHeight;
  }

  const floorY = firstPerson.baseHeight + firstPerson.cameraHeight;
  if (fpCamera.position.y < floorY) {
    firstPerson.velocity.y = 0;
    fpCamera.position.y = floorY;
    firstPerson.canJump = true;
  }
}

function getRandomWalkablePosition(layout) {
  if (!layout?.levels?.length) {
    return null;
  }

  const [level] = layout.levels;
  if (!level) {
    return null;
  }

  const walkableCells = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const cell = level.grid[y][x];
      if (cell && !cell.solid) {
        walkableCells.push({ x, y });
      }
    }
  }

  if (walkableCells.length === 0) {
    return null;
  }

  const randomCell = walkableCells[Math.floor(Math.random() * walkableCells.length)];
  const cellSize = layout.cellSize ?? 1;
  const halfWidth = (level.width * cellSize) / 2;
  const halfHeight = (level.height * cellSize) / 2;
  const cell = level.grid[randomCell.y][randomCell.x];
  const cellElevation = Number.isFinite(cell?.elevation) ? cell.elevation : 0;

  const worldX = randomCell.x * cellSize + cellSize / 2 - halfWidth;
  const worldZ = randomCell.y * cellSize + cellSize / 2 - halfHeight;
  const groundHeight = level.elevation + cellElevation;

  return {
    position: new THREE.Vector3(worldX, groundHeight + FIRST_PERSON_CAMERA_HEIGHT, worldZ),
    groundHeight
  };
}

function getGroundHeightAtPosition(layout, worldX, worldZ, worldY) {
  if (!layout?.levels?.length) {
    return null;
  }
  const level = findClosestLevel(layout, worldY);
  if (!level) {
    return null;
  }

  const cellSize = layout.cellSize ?? 1;
  const halfWidth = (level.width * cellSize) / 2;
  const halfHeight = (level.height * cellSize) / 2;
  const gridX = Math.floor((worldX + halfWidth) / cellSize);
  const gridY = Math.floor((worldZ + halfHeight) / cellSize);

  if (gridY < 0 || gridY >= level.height || gridX < 0 || gridX >= level.width) {
    return null;
  }

  const cell = level.grid[gridY][gridX];
  if (!cell || cell.solid) {
    return null;
  }

  const baseHeight = Number.isFinite(cell.elevation) ? cell.elevation : 0;
  if (!cell.rampDir || !Number.isFinite(cell.rampRise) || cell.rampRise === 0) {
    return level.elevation + baseHeight;
  }

  const localX = (worldX + halfWidth) / cellSize - gridX;
  const localZ = (worldZ + halfHeight) / cellSize - gridY;
  const rampHeight = getRampHeight(baseHeight, cell.rampDir, cell.rampRise, localX, localZ);

  return level.elevation + rampHeight;
}

function findClosestLevel(layout, worldY) {
  if (!layout?.levels?.length) {
    return null;
  }
  let closest = layout.levels[0];
  let minDist = Math.abs((closest.elevation ?? 0) - worldY);
  for (const level of layout.levels) {
    const dist = Math.abs((level.elevation ?? 0) - worldY);
    if (dist < minDist) {
      minDist = dist;
      closest = level;
    }
  }
  return closest;
}

function getRampHeight(baseHeight, rampDir, rampRise, localX, localZ) {
  const clampedX = Math.min(Math.max(localX, 0), 1);
  const clampedZ = Math.min(Math.max(localZ, 0), 1);
  switch (rampDir) {
    case "x+":
      return baseHeight + rampRise * clampedX;
    case "x-":
      return baseHeight + rampRise * (1 - clampedX);
    case "z+":
      return baseHeight + rampRise * clampedZ;
    case "z-":
      return baseHeight + rampRise * (1 - clampedZ);
    default:
      return baseHeight;
  }
}
