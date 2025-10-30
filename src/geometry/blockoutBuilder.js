import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DEFAULT_FLOOR_COLOR = 0x404040;
const DEFAULT_WALL_COLOR = 0xffffff;
const DEFAULT_COVER_COLOR = 0xff7b00;
const DEFAULT_PLATFORM_COLOR = 0x89d7e1;
const DEFAULT_SPAWN_COLOR = 0x59ff00;

export function buildBlockoutGroup(layout, colors = {}) {
  const group = new THREE.Group();
  group.name = "ArenaBlockout";

  const floorGeometries = [];
  const wallGeometries = [];
  const coverGeometries = [];
  const platformGeometries = [];
  const spawnGeometries = [];

  const {
    cellSize,
    wallHeight,
    wallThickness: wallThicknessParam,
    floorThickness,
    platformThickness,
    levels
  } = layout;
  const floorColor = new THREE.Color(colors.floorColor ?? DEFAULT_FLOOR_COLOR);
  const wallColor = new THREE.Color(colors.wallColor ?? DEFAULT_WALL_COLOR);
  const coverColor = new THREE.Color(colors.coverColor ?? DEFAULT_COVER_COLOR);
  const platformColor = new THREE.Color(
    colors.platformColor ?? DEFAULT_PLATFORM_COLOR
  );
  const spawnColor = new THREE.Color(
    colors.spawnColor ?? DEFAULT_SPAWN_COLOR
  );

  const effectivePlatformThickness = Math.max(
    0.001,
    Math.min(platformThickness ?? floorThickness, 10)
  );

  const wallThickness = Math.max(
    0.1,
    Math.min(
      Number.isFinite(wallThicknessParam)
        ? wallThicknessParam
        : Math.max(0.4, cellSize * 0.2),
      10
    )
  );

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
          floorThickness,
          cellSize,
          baseElevation: floorY,
          wallGeometries
        });

        if (cell.cover) {
          const coverHeight = 0.5;
          const cover = new THREE.BoxGeometry(
            cellSize * 0.6,
            coverHeight,
            cellSize * 0.6
          );
          cover.translate(wx, floorY + coverHeight / 2, wz);
          coverGeometries.push(cover);
        }

        if (cell.spawn) {
          const spawnHeight = 0.5;
          const spawn = new THREE.BoxGeometry(
            cellSize * 0.6,
            spawnHeight,
            cellSize * 0.6
          );
          spawn.translate(wx, floorY + spawnHeight / 2, wz);
          spawnGeometries.push(spawn);
        }

        if (cell.platformId !== null) {
          const platformHeight = effectivePlatformThickness;
          const platform = new THREE.BoxGeometry(
            cellSize,
            platformHeight,
            cellSize
          );
          const platformTop = floorY + wallHeight * 0.5;
          const platformY = platformTop - platformHeight / 2;
          platform.translate(wx, platformY, wz);
          platformGeometries.push(platform);
        }
      }
    }
  }

  addMergedMesh(
    group,
    floorGeometries,
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 }),
    { receiveShadow: true }
  );
  addMergedMesh(
    group,
    wallGeometries,
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.55 }),
    { castShadow: true, receiveShadow: true }
  );
  addMergedMesh(
    group,
    coverGeometries,
    new THREE.MeshStandardMaterial({ color: coverColor, roughness: 0.45 }),
    { castShadow: true, receiveShadow: true }
  );
  addMergedMesh(
    group,
    spawnGeometries,
    new THREE.MeshStandardMaterial({ color: spawnColor, roughness: 0.4 }),
    { castShadow: true, receiveShadow: true }
  );
  addMergedMesh(
    group,
    platformGeometries,
    new THREE.MeshStandardMaterial({ color: platformColor, roughness: 0.5 }),
    { castShadow: true, receiveShadow: true }
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
  floorThickness,
  cellSize,
  baseElevation,
  wallGeometries
}) {
  const totalWallHeight = wallHeight + floorThickness;
  const verticalOffset = (wallHeight - floorThickness) / 2;

  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    const neighborSolid =
      nx < 0 || nx >= width || ny < 0 || ny >= height || grid[ny][nx].solid;

    if (!neighborSolid) {
      continue;
    }

    const isEastWest = dir.dx !== 0;
    const wallWidth = isEastWest ? wallThickness : cellSize;
    const wallDepth = isEastWest ? cellSize : wallThickness;
    const outwardOffset =
      (cellSize / 2 + wallThickness / 2) * (isEastWest ? dir.dx : dir.dy);
    const offsetX = isEastWest ? outwardOffset : 0;
    const offsetZ = isEastWest ? 0 : outwardOffset;

    const wall = new THREE.BoxGeometry(
      wallWidth,
      totalWallHeight,
      wallDepth
    );
    wall.translate(
      wx + offsetX,
      baseElevation + verticalOffset,
      wz + offsetZ
    );
    wallGeometries.push(wall);
  }
}

function addMergedMesh(group, geometries, material, options = {}) {
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
  mesh.castShadow = Boolean(options.castShadow);
  mesh.receiveShadow = Boolean(options.receiveShadow);
  group.add(mesh);
}
