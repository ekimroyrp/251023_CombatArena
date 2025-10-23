import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import GUI from "lil-gui";
import seedrandom from "seedrandom";
import Stats from "stats.js";

const app = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f151a);
scene.fog = new THREE.FogExp2(0x0f151a, 0.025);

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
document.body.appendChild(stats.dom);

const params = {
  seed: "1337",
  gridWidth: 32,
  gridHeight: 24,
  cellSize: 4,
  rooms: 10,
  maxRoomSize: 8,
  corridorStyle: "L",
  coverProbability: 0.1,
  rampProbability: 0.05,
  wallHeight: 6,
  regenerate: () => rebuildArena()
};

const corridorModes = ["L", "Manhattan"];

const gui = new GUI();
const layoutFolder = gui.addFolder("Layout");
const seedController = layoutFolder
  .add(params, "seed")
  .name("Seed")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "gridWidth", 8, 64, 1)
  .name("Grid Width")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "gridHeight", 8, 64, 1)
  .name("Grid Height")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "cellSize", 2, 8, 0.5)
  .name("Cell Size")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "rooms", 4, 32, 1)
  .name("Rooms")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "maxRoomSize", 4, 16, 1)
  .name("Max Room")
  .onFinishChange(rebuildArena);
layoutFolder
  .add(params, "corridorStyle", corridorModes)
  .name("Corridor")
  .onFinishChange(rebuildArena);
layoutFolder.open();

const propsFolder = gui.addFolder("Props");
propsFolder
  .add(params, "coverProbability", 0, 0.5, 0.01)
  .name("Cover Chance")
  .onFinishChange(rebuildArena);
propsFolder
  .add(params, "rampProbability", 0, 0.3, 0.01)
  .name("Ramp Chance")
  .onFinishChange(rebuildArena);
propsFolder
  .add(params, "wallHeight", 3, 12, 0.5)
  .name("Wall Height")
  .onFinishChange(rebuildArena);
propsFolder.add(params, "regenerate").name("Regenerate");
propsFolder.open();

const actionsFolder = gui.addFolder("Actions");
actionsFolder
  .add(
    {
      nextSeed: () => {
        params.seed = Math.floor(Math.random() * 100000).toString();
        rebuildArena();
        seedController.updateDisplay();
      }
    },
    "nextSeed"
  )
  .name("Roll Seed");

let currentArena = null;

function rebuildArena() {
  if (currentArena) {
    disposeHierarchy(currentArena);
    scene.remove(currentArena);
  }

  const arena = buildBlockout(params);
  currentArena = arena;
  scene.add(currentArena);
}

function buildBlockout(options) {
  const rng = seedrandom(options.seed);
  const width = Math.floor(options.gridWidth);
  const height = Math.floor(options.gridHeight);
  const grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      solid: true,
      cover: false,
      ramp: false
    }))
  );

  const rooms = carveRooms(grid, options, rng);
  connectRooms(grid, rooms, options, rng);
  tagProps(grid, options, rng);

  const contents = new THREE.Group();
  contents.name = "ArenaBlockout";

  const floorGeometry = [];
  const wallGeometry = [];
  const coverGeometry = [];
  const rampGeometry = [];

  const { cellSize, wallHeight } = options;
  const halfWidth = (width * cellSize) / 2;
  const halfHeight = (height * cellSize) / 2;
  const floorThickness = Math.max(0.5, cellSize * 0.1);
  const wallThickness = Math.max(0.4, cellSize * 0.2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }

      const wx = x * cellSize + cellSize / 2 - halfWidth;
      const wz = y * cellSize + cellSize / 2 - halfHeight;

      const floor = new THREE.BoxGeometry(cellSize, floorThickness, cellSize);
      floor.translate(wx, -floorThickness / 2, wz);
      floorGeometry.push(floor);

      const directions = [
        {
          dx: 1,
          dy: 0,
          size: [wallThickness, wallHeight, cellSize],
          offset: [cellSize / 2, wallHeight / 2, 0]
        },
        {
          dx: -1,
          dy: 0,
          size: [wallThickness, wallHeight, cellSize],
          offset: [-cellSize / 2, wallHeight / 2, 0]
        },
        {
          dx: 0,
          dy: 1,
          size: [cellSize, wallHeight, wallThickness],
          offset: [0, wallHeight / 2, cellSize / 2]
        },
        {
          dx: 0,
          dy: -1,
          size: [cellSize, wallHeight, wallThickness],
          offset: [0, wallHeight / 2, -cellSize / 2]
        }
      ];

      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (!isInside(nx, ny, width, height) || grid[ny][nx].solid) {
          const wall = new THREE.BoxGeometry(
            dir.size[0],
            dir.size[1],
            dir.size[2]
          );
          wall.translate(wx + dir.offset[0], dir.offset[1], wz + dir.offset[2]);
          wallGeometry.push(wall);
        }
      }

      if (cell.cover) {
        const cover = new THREE.BoxGeometry(
          cellSize * 0.6,
          wallHeight * 0.4,
          cellSize * 0.6
        );
        cover.translate(wx, wallHeight * 0.2, wz);
        coverGeometry.push(cover);
      } else if (cell.ramp) {
        // Simple placeholder ramp block so players can access verticality.
        const ramp = new THREE.BoxGeometry(
          cellSize,
          wallHeight * 0.2,
          cellSize
        );
        ramp.translate(wx, wallHeight * 0.1, wz);
        rampGeometry.push(ramp);
      }
    }
  }

  if (floorGeometry.length) {
    const mergedFloors = mergeGeometries(floorGeometry, false);
    const floorMesh = new THREE.Mesh(
      mergedFloors,
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.8 })
    );
    floorMesh.receiveShadow = true;
    contents.add(floorMesh);
  }

  if (wallGeometry.length) {
    const mergedWalls = mergeGeometries(wallGeometry, false);
    const wallMesh = new THREE.Mesh(
      mergedWalls,
      new THREE.MeshStandardMaterial({ color: 0x1f252c, roughness: 0.5 })
    );
    wallMesh.castShadow = true;
    contents.add(wallMesh);
  }

  if (coverGeometry.length) {
    const mergedCover = mergeGeometries(coverGeometry, false);
    const coverMesh = new THREE.Mesh(
      mergedCover,
      new THREE.MeshStandardMaterial({ color: 0x4f5864, roughness: 0.4 })
    );
    contents.add(coverMesh);
  }

  if (rampGeometry.length) {
    const mergedRamp = mergeGeometries(rampGeometry, false);
    const rampMesh = new THREE.Mesh(
      mergedRamp,
      new THREE.MeshStandardMaterial({ color: 0x5a664f, roughness: 0.6 })
    );
    contents.add(rampMesh);
  }

  return contents;
}

function carveRooms(grid, options, rng) {
  const rooms = [];
  const { rooms: targetRooms, maxRoomSize } = options;
  const maxAttempts = targetRooms * 10;
  let attempts = 0;

  while (rooms.length < targetRooms && attempts < maxAttempts) {
    attempts += 1;

    const width = Math.max(
      3,
      Math.floor(rng() * Math.min(maxRoomSize, options.gridWidth / 2)) + 3
    );
    const height = Math.max(
      3,
      Math.floor(rng() * Math.min(maxRoomSize, options.gridHeight / 2)) + 3
    );
    const x = Math.floor(rng() * (options.gridWidth - width - 1)) + 1;
    const y = Math.floor(rng() * (options.gridHeight - height - 1)) + 1;

    if (!roomFits(grid, x, y, width, height)) {
      continue;
    }

    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        grid[y + dy][x + dx].solid = false;
      }
    }

    rooms.push({
      x,
      y,
      width,
      height,
      center: {
        x: Math.floor(x + width / 2),
        y: Math.floor(y + height / 2)
      }
    });
  }

  // Ensure at least one room exists at spawn.
  if (rooms.length === 0) {
    const fallbackRoom = {
      x: Math.floor(options.gridWidth / 3),
      y: Math.floor(options.gridHeight / 3),
      width: Math.min(6, options.gridWidth - 2),
      height: Math.min(6, options.gridHeight - 2)
    };
    for (let dy = 0; dy < fallbackRoom.height; dy += 1) {
      for (let dx = 0; dx < fallbackRoom.width; dx += 1) {
        grid[fallbackRoom.y + dy][fallbackRoom.x + dx].solid = false;
      }
    }
    rooms.push({
      ...fallbackRoom,
      center: {
        x: Math.floor(fallbackRoom.x + fallbackRoom.width / 2),
        y: Math.floor(fallbackRoom.y + fallbackRoom.height / 2)
      }
    });
  }

  return rooms;
}

function connectRooms(grid, rooms, options, rng) {
  if (rooms.length <= 1) {
    return;
  }

  const sortedRooms = [...rooms].sort((a, b) => a.center.x - b.center.x);

  for (let i = 1; i < sortedRooms.length; i += 1) {
    const prev = sortedRooms[i - 1];
    const next = sortedRooms[i];
    carveCorridor(grid, prev.center, next.center, options, rng);
  }
}

function carveCorridor(grid, from, to, options, rng) {
  const width = grid[0].length;
  const height = grid.length;
  const points = [];

  if (options.corridorStyle === "Manhattan") {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x;
    let y = from.y;

    while (x !== to.x || y !== to.y) {
      if (Math.abs(to.x - x) > Math.abs(to.y - y)) {
        x += dx;
      } else {
        y += dy;
      }
      points.push({ x, y });
    }
  } else {
    const horizontalFirst = rng() > 0.5;
    if (horizontalFirst) {
      const step = Math.sign(to.x - from.x);
      for (let x = from.x; x !== to.x; x += step) {
        points.push({ x, y: from.y });
      }
      const stepY = Math.sign(to.y - from.y);
      for (let y = from.y; y !== to.y; y += stepY) {
        points.push({ x: to.x, y });
      }
    } else {
      const stepY = Math.sign(to.y - from.y);
      for (let y = from.y; y !== to.y; y += stepY) {
        points.push({ x: from.x, y });
      }
      const step = Math.sign(to.x - from.x);
      for (let x = from.x; x !== to.x; x += step) {
        points.push({ x, y: to.y });
      }
    }
  }

  for (const p of points) {
    if (isInside(p.x, p.y, width, height)) {
      grid[p.y][p.x].solid = false;
    }
  }
}

function tagProps(grid, options, rng) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }

      if (rng() < options.coverProbability) {
        cell.cover = true;
        continue;
      }

      if (rng() < options.rampProbability) {
        cell.ramp = true;
      }
    }
  }
}

function roomFits(grid, x, y, width, height) {
  for (let dy = -1; dy <= height; dy += 1) {
    for (let dx = -1; dx <= width; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isInside(nx, ny, grid[0].length, grid.length)) {
        return false;
      }
      if (!grid[ny][nx].solid) {
        return false;
      }
    }
  }
  return true;
}

function isInside(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function disposeHierarchy(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    }
  });
}

function animate() {
  stats.begin();
  controls.update();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(animate);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

rebuildArena();
animate();
