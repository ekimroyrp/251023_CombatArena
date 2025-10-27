import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DEFAULT_FLOOR_COLOR = 0x404040;
const DEFAULT_WALL_COLOR = 0xffffff;
const DEFAULT_COVER_COLOR = 0x707070;
const DEFAULT_PLATFORM_COLOR = 0x949494;

export function buildBlockoutGroup(layout, colors = {}) {
  const group = new THREE.Group();
  group.name = "ArenaBlockout";

  const floorGeometries = [];
  const wallGeometries = [];
  const coverGeometries = [];
  const platformGeometries = [];

  const { cellSize, wallHeight, floorThickness, levels } = layout;
  const floorColor = new THREE.Color(colors.floorColor ?? DEFAULT_FLOOR_COLOR);
  const wallColor = new THREE.Color(colors.wallColor ?? DEFAULT_WALL_COLOR);
  const coverColor = new THREE.Color(colors.coverColor ?? DEFAULT_COVER_COLOR);
  const platformColor = new THREE.Color(
    colors.platformColor ?? DEFAULT_PLATFORM_COLOR
  );

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
    new THREE.MeshStandardMaterial({ color: coverColor, roughness: 0.4 })
  );
  addMergedMesh(
    group,
    platformGeometries,
    new THREE.MeshStandardMaterial({ color: platformColor, roughness: 0.5 })
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
