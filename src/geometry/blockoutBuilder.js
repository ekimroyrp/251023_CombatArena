import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DEFAULT_FLOOR_COLOR = 0x404040;
const DEFAULT_WALL_COLOR = 0xffffff;
const DEFAULT_COVER_COLOR = 0xff7b00;
const DEFAULT_PLATFORM_COLOR = 0x89d7e1;
const DEFAULT_SPAWN_COLOR = 0x59ff00;
const DEFAULT_ROOM_HIGHLIGHT_COLOR = 0xffa500;

export function buildBlockoutGroup(layout, colors = {}) {
  const group = new THREE.Group();
  group.name = "ArenaBlockout";

  const floorGeometries = [];
  const wallGeometries = [];
  const coverGeometries = [];
  const platformGeometries = [];
  const spawnGeometries = [];
  const roomHighlightGeometries = [];

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
  const roomHighlightColor = new THREE.Color(
    colors.roomHighlightColor ?? DEFAULT_ROOM_HIGHLIGHT_COLOR
  );
  const roomHighlightEnabled = Boolean(colors.roomHighlight);

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
  const roomHighlightHeight = Math.max(
    0.02,
    Math.min(floorThickness * 0.25, 0.15)
  );
  const roomHighlightOffset = Math.max(0.01, roomHighlightHeight * 0.25);

  for (const level of levels) {
    const halfWidth = (level.width * cellSize) / 2;
    const halfHeight = (level.height * cellSize) / 2;
    const floorY = level.elevation;

    if (roomHighlightEnabled && Array.isArray(level.rooms)) {
      for (const room of level.rooms) {
        if (!room || room.width <= 0 || room.height <= 0) {
          continue;
        }
        const roomWidth = room.width * cellSize;
        const roomHeight = room.height * cellSize;
        const centerX = (room.x + room.width / 2) * cellSize - halfWidth;
        const centerZ = (room.y + room.height / 2) * cellSize - halfHeight;
        const highlight = new THREE.BoxGeometry(
          roomWidth,
          roomHighlightHeight,
          roomHeight
        );
        highlight.translate(
          centerX,
          floorY + roomHighlightHeight / 2 + roomHighlightOffset,
          centerZ
        );
        roomHighlightGeometries.push(highlight);
      }
    }

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

        if (cell.cover) {
          const coverHeight = 1;
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

    addWallsForLevel({
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
  }

  addMergedMesh(
    group,
    floorGeometries,
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 }),
    { receiveShadow: true }
  );
  addMergedMesh(
    group,
    roomHighlightGeometries,
    new THREE.MeshStandardMaterial({
      color: roomHighlightColor,
      roughness: 0.35,
      transparent: true,
      opacity: 0.6
    })
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

function addWallsForLevel({
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
  const halfWidth = (width * cellSize) / 2;
  const halfHeight = (height * cellSize) / 2;

  const emitSegment = ({
    alongX,
    startIndex,
    length,
    boundaryCoord,
    direction
  }) => {
    if (length <= 0) {
      return;
    }
    const wallLength = length * cellSize;
    const centerY = baseElevation + verticalOffset;
    if (alongX) {
      const startX = startIndex * cellSize - halfWidth;
      const centerX = startX + wallLength / 2;
      const centerZ = boundaryCoord + direction * (wallThickness / 2);
      const wall = new THREE.BoxGeometry(
        wallLength,
        totalWallHeight,
        wallThickness
      );
      wall.translate(centerX, centerY, centerZ);
      wallGeometries.push(wall);
    } else {
      const startZ = startIndex * cellSize - halfHeight;
      const centerZ = startZ + wallLength / 2;
      const centerX = boundaryCoord + direction * (wallThickness / 2);
      const wall = new THREE.BoxGeometry(
        wallThickness,
        totalWallHeight,
        wallLength
      );
      wall.translate(centerX, centerY, centerZ);
      wallGeometries.push(wall);
    }
  };

  // Walls parallel to Z axis (between columns)
  for (let xEdge = 0; xEdge <= width; xEdge += 1) {
    let runStart = null;
    let runDir = 0;

    for (let y = 0; y < height; y += 1) {
      const leftCell = xEdge > 0 ? grid[y][xEdge - 1] : null;
      const rightCell = xEdge < width ? grid[y][xEdge] : null;
      const leftOpen = leftCell ? !leftCell.solid : false;
      const rightOpen = rightCell ? !rightCell.solid : false;
      let dir = 0;

      if (leftOpen !== rightOpen) {
        dir = leftOpen ? 1 : -1;
      }

      if (dir !== 0) {
        if (runStart === null || runDir !== dir) {
          if (runStart !== null) {
            emitSegment({
              alongX: false,
              startIndex: runStart,
              length: y - runStart,
              boundaryCoord: xEdge * cellSize - halfWidth,
              direction: runDir
            });
          }
          runStart = y;
          runDir = dir;
        }
      } else if (runStart !== null) {
        emitSegment({
          alongX: false,
          startIndex: runStart,
          length: y - runStart,
          boundaryCoord: xEdge * cellSize - halfWidth,
          direction: runDir
        });
        runStart = null;
        runDir = 0;
      }
    }

    if (runStart !== null) {
      emitSegment({
        alongX: false,
        startIndex: runStart,
        length: height - runStart,
        boundaryCoord: xEdge * cellSize - halfWidth,
        direction: runDir
      });
    }
  }

  // Walls parallel to X axis (between rows)
  for (let yEdge = 0; yEdge <= height; yEdge += 1) {
    let runStart = null;
    let runDir = 0;

    for (let x = 0; x < width; x += 1) {
      const topCell = yEdge > 0 ? grid[yEdge - 1][x] : null;
      const bottomCell = yEdge < height ? grid[yEdge][x] : null;
      const topOpen = topCell ? !topCell.solid : false;
      const bottomOpen = bottomCell ? !bottomCell.solid : false;
      let dir = 0;

      if (topOpen !== bottomOpen) {
        dir = topOpen ? 1 : -1;
      }

      if (dir !== 0) {
        if (runStart === null || runDir !== dir) {
          if (runStart !== null) {
            emitSegment({
              alongX: true,
              startIndex: runStart,
              length: x - runStart,
              boundaryCoord: yEdge * cellSize - halfHeight,
              direction: runDir
            });
          }
          runStart = x;
          runDir = dir;
        }
      } else if (runStart !== null) {
        emitSegment({
          alongX: true,
          startIndex: runStart,
          length: x - runStart,
          boundaryCoord: yEdge * cellSize - halfHeight,
          direction: runDir
        });
        runStart = null;
        runDir = 0;
      }
    }

    if (runStart !== null) {
      emitSegment({
        alongX: true,
        startIndex: runStart,
        length: width - runStart,
        boundaryCoord: yEdge * cellSize - halfHeight,
        direction: runDir
      });
    }
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
