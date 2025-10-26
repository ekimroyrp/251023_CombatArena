import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const COVER_COLOR = 0x4f5864;
const PLATFORM_COLOR = 0xd8dce1;
const RAMP_COLOR = 0x5a664f;

export function buildBlockoutGroup(layout, colors = {}) {
  const group = new THREE.Group();
  group.name = "ArenaBlockout";

  const floorGeometries = [];
  const wallGeometries = [];
  const coverGeometries = [];
  const platformGeometries = [];
  const rampGeometries = [];

  const { cellSize, wallHeight, floorThickness, levels } = layout;
  const floorColor = new THREE.Color(colors.floorColor ?? 0x3a3f47);
  const wallColor = new THREE.Color(colors.wallColor ?? 0x1f252c);
  const platformColor = new THREE.Color(colors.platformColor ?? PLATFORM_COLOR);

  const wallThickness = Math.max(0.4, cellSize * 0.2);

  for (const level of levels) {
    const halfWidth = (level.width * cellSize) / 2;
    const halfHeight = (level.height * cellSize) / 2;
    const floorY = level.elevation;

    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const cell = level.grid[y][x];
        if (cell.solid) {
          continue;
        }

        const wx = x * cellSize + cellSize / 2 - halfWidth;
        const wz = y * cellSize + cellSize / 2 - halfHeight;

        const floor = new THREE.BoxGeometry(cellSize, floorThickness, cellSize);
        floor.translate(wx, floorY - floorThickness / 2, wz);
        floorGeometries.push(floor);

        addWallsForCell({
          x,
          y,
          wx,
          wz,
          grid: level.grid,
          width: level.width,
          height: level.height,
          wallThickness,
          wallHeight,
          cellSize,
          baseElevation: floorY,
          wallGeometries
        });

        if (cell.cover) {
          const cover = new THREE.BoxGeometry(
            cellSize * 0.6,
            wallHeight * 0.4,
            cellSize * 0.6
          );
          cover.translate(wx, floorY + wallHeight * 0.2, wz);
          coverGeometries.push(cover);
        }

        if (cell.rampUp) {
          const ramp = createRampGeometry(cellSize, wallHeight);
          ramp.translate(wx, floorY, wz);
          rampGeometries.push(ramp);
        }

        if (cell.platformId !== null) {
          const platform = new THREE.BoxGeometry(
            cellSize,
            floorThickness,
            cellSize
          );
          const platformY =
            floorY + wallHeight * 0.5 - floorThickness / 2;
          platform.translate(wx, platformY, wz);
          platformGeometries.push(platform);
        }
      }
    }
  }

  addMergedMesh(
    group,
    floorGeometries,
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 })
  );
  addMergedMesh(
    group,
    wallGeometries,
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.5 })
  );
  addMergedMesh(
    group,
    coverGeometries,
    new THREE.MeshStandardMaterial({ color: COVER_COLOR, roughness: 0.4 })
  );
  addMergedMesh(
    group,
    platformGeometries,
    new THREE.MeshStandardMaterial({ color: platformColor, roughness: 0.5 })
  );
  addMergedMesh(
    group,
    rampGeometries,
    new THREE.MeshStandardMaterial({ color: RAMP_COLOR, roughness: 0.6 })
  );

  return group;
}

function addWallsForCell({
  x,
  y,
  wx,
  wz,
  grid,
  width,
  height,
  wallThickness,
  wallHeight,
  cellSize,
  baseElevation,
  wallGeometries
}) {
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
    const neighborSolid =
      nx < 0 || nx >= width || ny < 0 || ny >= height || grid[ny][nx].solid;

    if (!neighborSolid) {
      continue;
    }

    const wall = new THREE.BoxGeometry(
      dir.size[0],
      dir.size[1],
      dir.size[2]
    );
    wall.translate(
      wx + dir.offset[0],
      baseElevation + dir.offset[1],
      wz + dir.offset[2]
    );
    wallGeometries.push(wall);
  }
}

function createRampGeometry(cellSize, wallHeight) {
  const halfWidth = cellSize / 2;
  const halfDepth = cellSize / 2;
  const h = wallHeight;

  const positions = new Float32Array([
    // Bottom
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    halfWidth, 0, halfDepth,

    -halfWidth, 0, -halfDepth,
    halfWidth, 0, halfDepth,
    -halfWidth, 0, halfDepth,

    // Back vertical
    -halfWidth, 0, halfDepth,
    halfWidth, 0, halfDepth,
    halfWidth, h, halfDepth,

    -halfWidth, 0, halfDepth,
    halfWidth, h, halfDepth,
    -halfWidth, h, halfDepth,

    // Left triangle
    -halfWidth, 0, -halfDepth,
    -halfWidth, 0, halfDepth,
    -halfWidth, h, halfDepth,

    // Right triangle
    halfWidth, 0, -halfDepth,
    halfWidth, h, halfDepth,
    halfWidth, 0, halfDepth,

    // Slope
    -halfWidth, h, halfDepth,
    halfWidth, h, halfDepth,
    halfWidth, 0, -halfDepth,

    -halfWidth, h, halfDepth,
    halfWidth, 0, -halfDepth,
    -halfWidth, 0, -halfDepth
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals();

  return geometry;
}

function addMergedMesh(group, geometries, material) {
  if (geometries.length === 0) {
    material.dispose();
    return;
  }

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());

  if (!merged) {
    material.dispose();
    return;
  }

  const mesh = new THREE.Mesh(merged, material);
  group.add(mesh);
}
