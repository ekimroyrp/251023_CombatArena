import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const FLOOR_COLOR = 0x3a3f47;
const WALL_COLOR = 0x1f252c;
const COVER_COLOR = 0x4f5864;
const RAMP_COLOR = 0x5a664f;

export function buildBlockoutGroup(layout) {
  const group = new THREE.Group();
  group.name = "ArenaBlockout";

  const floorGeometries = [];
  const wallGeometries = [];
  const coverGeometries = [];
  const rampGeometries = [];

  const { grid, width, height, cellSize, wallHeight } = layout;
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
      floorGeometries.push(floor);

      addWallsForCell({
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
        wallGeometries
      });

      if (cell.cover) {
        const cover = new THREE.BoxGeometry(
          cellSize * 0.6,
          wallHeight * 0.4,
          cellSize * 0.6
        );
        cover.translate(wx, wallHeight * 0.2, wz);
        coverGeometries.push(cover);
      } else if (cell.ramp) {
        const ramp = new THREE.BoxGeometry(
          cellSize,
          wallHeight * 0.2,
          cellSize
        );
        ramp.translate(wx, wallHeight * 0.1, wz);
        rampGeometries.push(ramp);
      }
    }
  }

  addMergedMesh(group, floorGeometries, new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.8 }));
  addMergedMesh(group, wallGeometries, new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.5 }));
  addMergedMesh(group, coverGeometries, new THREE.MeshStandardMaterial({ color: COVER_COLOR, roughness: 0.4 }));
  addMergedMesh(group, rampGeometries, new THREE.MeshStandardMaterial({ color: RAMP_COLOR, roughness: 0.6 }));

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
    wall.translate(wx + dir.offset[0], dir.offset[1], wz + dir.offset[2]);
    wallGeometries.push(wall);
  }
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
