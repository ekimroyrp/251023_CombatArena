import { getCorridorPath } from "./corridors.js";
import { createRng, randomFloat, randomInt, shuffleInPlace } from "../utils/random.js";

const STYLE_PROFILES = {
  Halo: {
    roomDensity: 1.0,
    verticality: 1.3,
    loopFactor: 1.2,
    coverBias: 1.15,
    corridorStyle: "L",
    corridorBlend: 0.3,
    corridorPadding: 1,
    longRoomBias: 0.45,
    rectangularity: 1.25
  },
  "Counter Strike 2": {
    roomDensity: 0.9,
    verticality: 0.75,
    loopFactor: 0.7,
    coverBias: 1.45,
    corridorStyle: "Manhattan",
    corridorBlend: 0.8,
    corridorPadding: 1,
    longRoomBias: 0.7,
    rectangularity: 1.6
  },
  Quake: {
    roomDensity: 1.25,
    verticality: 1.6,
    loopFactor: 1.5,
    coverBias: 0.75,
    corridorStyle: "Bresenham",
    corridorBlend: 0.7,
    corridorPadding: 2,
    carveDiagonals: true,
    longRoomBias: 0.35,
    rectangularity: 1.15,
    atriumChance: 0.2
  }
};

export function generateArenaLayout(options) {
  const config = normalizeOptions(options);
  const floorThickness = config.floorThickness;
  const levelSpacing = config.wallHeight + config.floorThickness;

  const levels = [];
  let remainingSpawns = config.spawnAmount;

  for (let levelIndex = 0; levelIndex < config.floors; levelIndex += 1) {
    const levelSeed = `${config.seed}-L${levelIndex}`;
    const levelRng = createRng(levelSeed);
    const roomSizeRng = createRng(
      `${config.seed}-room-size-${config.roomSizeSeed ?? "1"}-L${levelIndex}`
    );
    const grid = createGrid(config.width, config.height);
    const rooms = carveRooms(grid, config, levelRng, roomSizeRng);

    if (rooms.length === 0) {
      const fallback = createFallbackRoom(config);
      const roomId = 0;
      const taggedFallback = { ...fallback, id: roomId };
      paintRoom(grid, taggedFallback, roomId);
      rooms.push(addRoomCenter(taggedFallback));
    }

    assignRoomElevations(grid, rooms, config, levelIndex);
    connectRooms(grid, rooms, config, levelRng);
    sprinkleCover(grid, config, createRng(`${config.seed}-cover-${levelIndex}-${config.coverSeed}`));
    const platformRng = createRng(
      `${config.seed}-platform-${config.platformSeed}-L${levelIndex}`
    );
    const platformCount = buildPlatforms(grid, config, platformRng);
    const spawnRng = createRng(
      `${config.seed}-spawn-${config.spawnSeed}-L${levelIndex}`
    );
    let availableCells = 0;
    for (let y = 0; y < grid.length; y += 1) {
      for (let x = 0; x < grid[y].length; x += 1) {
        const cell = grid[y][x];
        if (!cell.solid) {
          availableCells += 1;
        }
      }
    }
    const levelsRemaining = config.floors - levelIndex;
    const targetSpawns = Math.min(
      remainingSpawns,
      availableCells
    );
    let spawnForLevel = levelsRemaining > 0
      ? Math.min(targetSpawns, Math.ceil(remainingSpawns / levelsRemaining))
      : targetSpawns;
    spawnForLevel = Math.max(0, spawnForLevel);
    const spawnPlaced = placeSpawnPoints(grid, spawnForLevel, spawnRng);
    remainingSpawns = Math.max(0, remainingSpawns - spawnPlaced);

    fillMissingElevations(grid);

    levels.push({
      index: levelIndex,
      elevation: levelIndex * levelSpacing,
      width: config.width,
      height: config.height,
      grid,
      rooms,
      platformCount
    });
  }

  applySymmetry(levels, config);

  return {
    cellSize: config.cellSize,
    wallHeight: config.wallHeight,
    wallThickness: config.wallThickness,
    floorThickness,
    platformThickness: config.platformThickness,
    platformHeight: config.platformHeight,
    levelSpacing,
    levels
  };
}

function normalizeOptions(options) {
  const width = clamp(Math.floor(options.gridWidth ?? 32), 8, 96);
  const height = clamp(Math.floor(options.gridHeight ?? 24), 8, 96);
  const defaultRoomSizeMax = clamp(Math.floor(options.maxRoomSize ?? 8), 3, 24);
  const roomSizeMinRaw = clamp(Math.floor(options.roomSizeMin ?? 4), 3, 24);
  const roomSizeMaxRaw = clamp(
    Math.floor(options.roomSizeMax ?? defaultRoomSizeMax),
    3,
    24
  );
  const roomSizeMin = Math.min(roomSizeMinRaw, roomSizeMaxRaw);
  const roomSizeMax = Math.max(roomSizeMinRaw, roomSizeMaxRaw);
  const roomSizeSeed = clamp(Math.floor(options.roomSizeSeed ?? 1), 1, 1000);
  const effectiveRoomSizeMax = Math.min(roomSizeMax, width - 2, height - 2);
  const effectiveRoomSizeMin = Math.min(roomSizeMin, effectiveRoomSizeMax);
  const maxRoomSize = effectiveRoomSizeMax;
  const spawnAmount = clamp(Math.floor(options.spawnAmount ?? 4), 0, 50);
  const spawnSeed = clamp(Math.floor(options.spawnSeed ?? 1), 1, 1000);

  const type = options.type ?? "Halo";
  const styleProfile = STYLE_PROFILES[type] ?? STYLE_PROFILES.Halo;

  const baseRooms = clamp(Math.floor(options.rooms ?? 10), 1, 96);
  const baseFloors = clamp(Math.floor(options.floors ?? 1), 1, 8);
  const rooms = clamp(
    Math.round(baseRooms * (styleProfile.roomDensity ?? 1)),
    1,
    96
  );
  const floors = baseFloors;

  const symmetryRaw = String(options.symmetry ?? "None").toUpperCase();
  const allowedSym = new Set([
    "NONE",
    "X",
    "Y",
    "XY",
    "X_NEG",
    "Y_POS",
    "XY_POS",
    "XY_NEG",
    "XY_NEG_LEFT"
  ]);
  const symmetry = allowedSym.has(symmetryRaw) ? symmetryRaw : "NONE";

  const rawSeed = clamp(Math.floor(options.seed ?? 0), 1, 1000);
  const platformSeed = clamp(Math.floor(options.platformSeed ?? 1), 1, 1000);
  const coverSeed = clamp(Math.floor(options.coverSeed ?? 1), 1, 1000);
  const floorThickness = clamp(
    Number.isFinite(options.floorThickness) ? options.floorThickness : 0.25,
    0.25,
    10
  );
  const wallThickness = clamp(
    Number.isFinite(options.wallThickness)
      ? options.wallThickness
      : 0.5,
    0.25,
    10
  );
  const platformThickness = clamp(
    Number.isFinite(options.platformThickness) ? options.platformThickness : 0.25,
    0.25,
    10
  );
  const basePlatforms = clamp(Math.floor(options.platforms ?? 0), 0, 100);
  const platformsPerFloor = clamp(
    Math.round(basePlatforms * (styleProfile.verticality ?? 1)),
    0,
    100
  );
  const platformHeightInput = Number.isFinite(options.platformHeight)
    ? options.platformHeight
    : wallHeight * 0.5;
  const platformHeightRaw = clamp(platformHeightInput, 0, 12);
  const platformHeight = quantize(platformHeightRaw, 0.25);

  const coverProbability = clamp01(
    ((options.coverProbability ?? 10.0) * 0.01) * (styleProfile.coverBias ?? 1)
  );

  const corridorStyle =
    options.corridorStyle ?? styleProfile.corridorStyle ?? "L";
  const baseCorridorPadding = Math.max(
    0,
    Math.round(styleProfile.corridorPadding ?? 1)
  );
  const corridorPaddingMinRaw = clamp(
    Math.floor(options.corridorPaddingMin ?? baseCorridorPadding),
    0,
    20
  );
  const corridorPaddingMaxRaw = clamp(
    Math.floor(options.corridorPaddingMax ?? baseCorridorPadding),
    0,
    20
  );
  const corridorPaddingMin = Math.min(corridorPaddingMinRaw, corridorPaddingMaxRaw);
  const corridorPaddingMax = Math.max(corridorPaddingMinRaw, corridorPaddingMaxRaw);
  const corridorSeed = clamp(Math.floor(options.corridorSeed ?? 1), 0, 1000);
  const wallHeight = clamp(
    Number.isFinite(options.wallHeight) ? options.wallHeight : 4,
    1,
    16
  );
  const elevationLimit = 10;
  const elevationStep = 0.25;
  const elevationMinRaw = clamp(
    Number(options.elevationMin ?? 0),
    -elevationLimit,
    elevationLimit
  );
  const elevationMaxRaw = clamp(
    Number(options.elevationMax ?? 0),
    -elevationLimit,
    elevationLimit
  );
  const elevationMin = quantize(
    Math.min(elevationMinRaw, elevationMaxRaw),
    elevationStep
  );
  const elevationMax = quantize(
    Math.max(elevationMinRaw, elevationMaxRaw),
    elevationStep
  );
  const elevationSeed = clamp(Math.floor(options.elevationSeed ?? 1), 1, 1000);
  const elevationChance = clamp(
    Number.isFinite(options.elevationChance) ? options.elevationChance : 100,
    0,
    100
  );

  return {
    seed: String(rawSeed),
    coverSeed: String(coverSeed),
    type,
    styleProfile,
    width,
    height,
    cellSize: clamp(options.cellSize ?? 2, 1, 10),
    rooms,
    floors,
    platformsPerFloor,
    platformSeed,
    platformHeight,
    roomSizeMin: effectiveRoomSizeMin,
    roomSizeMax: effectiveRoomSizeMax,
    roomSizeSeed: String(roomSizeSeed),
    spawnAmount,
    spawnSeed,
    floorThickness,
    wallThickness,
    platformThickness,
    symmetry,
    maxRoomSize: Math.min(maxRoomSize, width - 2, height - 2),
    corridorStyle,
    styleCorridor: styleProfile.corridorStyle ?? corridorStyle,
    corridorBlend: clamp01(styleProfile.corridorBlend ?? 0),
    corridorPaddingMin,
    corridorPaddingMax,
    corridorSeed: String(corridorSeed),
    carveDiagonals: Boolean(styleProfile.carveDiagonals),
    longRoomBias: clamp01(styleProfile.longRoomBias ?? 0.5),
    rectangularity: Math.max(1, styleProfile.rectangularity ?? 1),
    atriumChance: clamp01(styleProfile.atriumChance ?? 0),
    coverProbability,
    elevationMin,
    elevationMax,
    elevationChance,
    elevationSeed: String(elevationSeed),
    elevationStep,
    wallHeight,
    loopFactor: Math.max(0, styleProfile.loopFactor ?? 1)
  };
}

function createGrid(width, height) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      solid: true,
      cover: false,
      rampUp: false,
      rampDown: false,
      rampDir: null,
      rampRise: 0,
      platformId: null,
      spawn: false,
      roomId: null,
      elevation: null
    }))
  );
}

function carveRooms(grid, config, rng, sizeRng) {
  const rooms = [];
  const attemptsLimit = config.rooms * 12;
  let attempts = 0;

  const sizeRn = typeof sizeRng === "function" ? sizeRng : rng;
  const baseMinSize = Math.max(3, config.roomSizeMin ?? 3);
  const baseMaxSize = Math.max(baseMinSize, config.roomSizeMax ?? baseMinSize);

  while (rooms.length < config.rooms && attempts < attemptsLimit) {
    attempts += 1;

    let widthLimit = config.maxRoomSize;
    let heightLimit = config.maxRoomSize;

    if (rng() < config.longRoomBias) {
      const stretched = Math.round(config.maxRoomSize * config.rectangularity);
      if (rng() < 0.5) {
        widthLimit = Math.min(stretched, config.width - 2);
      } else {
        heightLimit = Math.min(stretched, config.height - 2);
      }
    }

    if (rng() < config.atriumChance) {
      const scale = 1 + rng() * 0.6;
      widthLimit = Math.min(
        Math.round(config.maxRoomSize * scale),
        config.width - 2
      );
      heightLimit = Math.min(
        Math.round(config.maxRoomSize * scale),
        config.height - 2
      );
    }

    widthLimit = Math.max(3, Math.min(widthLimit, config.width - 2));
    heightLimit = Math.max(3, Math.min(heightLimit, config.height - 2));

    const minWidth = Math.min(widthLimit, baseMinSize);
    const maxWidth = Math.max(minWidth, Math.min(widthLimit, baseMaxSize));
    const roomWidth = clamp(
      randomInt(sizeRn, Math.floor(minWidth), Math.floor(maxWidth)),
      3,
      config.width - 2
    );

    const minHeight = Math.min(heightLimit, baseMinSize);
    const maxHeight = Math.max(minHeight, Math.min(heightLimit, baseMaxSize));
    const roomHeight = clamp(
      randomInt(sizeRn, Math.floor(minHeight), Math.floor(maxHeight)),
      3,
      config.height - 2
    );

    const x = randomInt(rng, 1, Math.max(1, config.width - roomWidth - 1));
    const y = randomInt(rng, 1, Math.max(1, config.height - roomHeight - 1));

    if (!roomFits(grid, x, y, roomWidth, roomHeight)) {
      continue;
    }

    const roomId = rooms.length;
    const room = {
      id: roomId,
      x,
      y,
      width: roomWidth,
      height: roomHeight
    };
    paintRoom(grid, room, roomId);
    rooms.push(addRoomCenter(room));
  }

  return rooms;
}

function createFallbackRoom(config) {
  const width = clamp(Math.floor(config.width / 3), 3, config.width - 2);
  const height = clamp(Math.floor(config.height / 3), 3, config.height - 2);

  return addRoomCenter({
    x: Math.max(1, Math.floor(config.width / 2 - width / 2)),
    y: Math.max(1, Math.floor(config.height / 2 - height / 2)),
    width,
    height
  });
}

function assignRoomElevations(grid, rooms, config, levelIndex) {
  const elevationMin =
    Number.isFinite(config.elevationMin) ? config.elevationMin : 0;
  const elevationMax =
    Number.isFinite(config.elevationMax) ? config.elevationMax : 0;
  const elevationChance = clamp(
    Number.isFinite(config.elevationChance) ? config.elevationChance : 100,
    0,
    100
  );
  const elevationStep =
    Number.isFinite(config.elevationStep) ? config.elevationStep : 1;
  const seed = config.elevationSeed ?? "1";
  const elevationRng = createRng(
    `${config.seed}-elevation-${seed}-L${levelIndex}`
  );

  for (const room of rooms) {
    const canVary = elevationChance > 0 && elevationRng() * 100 < elevationChance;
    const elevation = canVary
      ? pickElevationStep(elevationRng, elevationMin, elevationMax, elevationStep)
      : 0;
    room.elevation = elevation;

    for (let dy = 0; dy < room.height; dy += 1) {
      for (let dx = 0; dx < room.width; dx += 1) {
        const cell = grid[room.y + dy][room.x + dx];
        cell.elevation = elevation;
        cell.rampUp = false;
        cell.rampDown = false;
        cell.rampDir = null;
        cell.rampRise = 0;
      }
    }
  }
}

function addRoomCenter(room) {
  return {
    ...room,
    center: {
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2)
    }
  };
}

function paintRoom(grid, room, roomId) {
  for (let dy = 0; dy < room.height; dy += 1) {
    for (let dx = 0; dx < room.width; dx += 1) {
      const cell = grid[room.y + dy][room.x + dx];
      cell.solid = false;
      cell.roomId = roomId ?? room.id ?? null;
    }
  }
}

function roomFits(grid, x, y, width, height) {
  for (let dy = -1; dy <= height; dy += 1) {
    for (let dx = -1; dx <= width; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!insideBounds(grid, nx, ny)) {
        return false;
      }
      if (!grid[ny][nx].solid) {
        return false;
      }
    }
  }

  return true;
}

function connectRooms(grid, rooms, config, rng) {
  if (rooms.length < 2) {
    return;
  }

  const connected = [rooms[0]];
  const remaining = rooms.slice(1);
  let corridorIndex = 0;

  while (remaining.length > 0) {
    let bestPair = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const source of connected) {
      for (const target of remaining) {
        const distance =
          (source.center.x - target.center.x) ** 2 +
          (source.center.y - target.center.y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPair = { source, target };
        }
      }
    }

    if (!bestPair) {
      break;
    }

    carveCorridor(grid, bestPair.source, bestPair.target, config, corridorIndex, rng);
    corridorIndex += 1;

    connected.push(bestPair.target);
    const index = remaining.indexOf(bestPair.target);
    remaining.splice(index, 1);
  }

  const loopBudget = Math.round(
    Math.min(rooms.length * config.loopFactor * 0.15, rooms.length - 1)
  );

  for (let i = 0; i < loopBudget; i += 1) {
    const a = rooms[randomInt(rng, 0, rooms.length - 1)];
    const b = rooms[randomInt(rng, 0, rooms.length - 1)];
    if (a === b) {
      continue;
    }
    carveCorridor(grid, a, b, config, corridorIndex, rng);
    corridorIndex += 1;
  }
}

function carveCorridor(grid, fromRoom, toRoom, config, corridorIndex, rng) {
  let corridorStyle = config.corridorStyle;
  if (
    config.styleCorridor &&
    config.styleCorridor !== corridorStyle &&
    typeof rng === "function" &&
    rng() < config.corridorBlend
  ) {
    corridorStyle = config.styleCorridor;
  }

  const path = getCorridorPath(
    corridorStyle,
    fromRoom.center,
    toRoom.center,
    rng
  );
  const padding = pickCorridorPadding(
    config,
    fromRoom.center,
    toRoom.center,
    corridorIndex
  );
  const pathHeights = resolveCorridorHeights(
    grid,
    path,
    Number.isFinite(fromRoom.elevation) ? fromRoom.elevation : 0,
    Number.isFinite(toRoom.elevation) ? toRoom.elevation : 0
  );

  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (!insideBounds(grid, point.x, point.y)) {
      continue;
    }
    const cell = grid[point.y][point.x];
    cell.solid = false;
    const height = pathHeights[index];
    if (height !== null && cell.roomId === null && cell.elevation === null) {
      cell.elevation = height;
    }

    // Soften hard diagonals by carving a plus-shaped footprint.
    const baseHeight = Number.isFinite(height)
      ? height
      : Number.isFinite(cell.elevation)
      ? cell.elevation
      : 0;
    carvePadding(
      grid,
      point.x,
      point.y,
      padding,
      config.carveDiagonals,
      baseHeight
    );
  }

  applyCorridorRamps(grid, path, pathHeights);
}

function pickCorridorPadding(config, from, to, corridorIndex) {
  const min = Math.max(0, Math.floor(config.corridorPaddingMin ?? 0));
  const max = Math.max(min, Math.floor(config.corridorPaddingMax ?? min));

  if (min === max) {
    return min;
  }

  const seedBase = `${config.seed}-corridor-${config.corridorSeed ?? "0"}-${corridorIndex}-${from.x}-${from.y}-${to.x}-${to.y}`;
  const paddingRng = createRng(seedBase);
  return randomInt(paddingRng, min, max);
}

function carvePadding(grid, x, y, radius, includeDiagonals, baseHeight) {
  for (let step = 1; step <= radius; step += 1) {
    const offsets = [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step]
    ];

    if (includeDiagonals) {
      offsets.push(
        [step, step],
        [step, -step],
        [-step, step],
        [-step, -step]
      );
    }

    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (insideBounds(grid, nx, ny)) {
        const cell = grid[ny][nx];
        cell.solid = false;
        if (cell.roomId === null && cell.elevation === null && Number.isFinite(baseHeight)) {
          cell.elevation = baseHeight;
        }
      }
    }
  }
}

function resolveCorridorHeights(grid, path, startHeight, endHeight) {
  const heights = Array(path.length).fill(null);
  let firstCorridor = -1;
  let lastCorridor = -1;

  for (let i = 0; i < path.length; i += 1) {
    const point = path[i];
    if (!insideBounds(grid, point.x, point.y)) {
      continue;
    }
    const cell = grid[point.y][point.x];
    if (cell.roomId === null) {
      if (firstCorridor === -1) {
        firstCorridor = i;
      }
      lastCorridor = i;
    }
  }

  if (firstCorridor === -1) {
    return heights;
  }

  const span = lastCorridor - firstCorridor;
  for (let i = firstCorridor; i <= lastCorridor; i += 1) {
    const t = span === 0 ? 0 : (i - firstCorridor) / span;
    heights[i] = startHeight + (endHeight - startHeight) * t;
  }

  return heights;
}

function applyCorridorRamps(grid, path, pathHeights) {
  for (let i = 0; i < path.length - 1; i += 1) {
    const current = path[i];
    const next = path[i + 1];
    if (!insideBounds(grid, current.x, current.y) || !insideBounds(grid, next.x, next.y)) {
      continue;
    }
    const cellA = grid[current.y][current.x];
    const cellB = grid[next.y][next.x];

    if (cellA.roomId !== null || cellB.roomId !== null) {
      continue;
    }

    const heightA = getCellElevation(cellA, pathHeights[i]);
    const heightB = getCellElevation(cellB, pathHeights[i + 1]);
    if (!Number.isFinite(heightA) || !Number.isFinite(heightB) || heightA === heightB) {
      continue;
    }

    const dir = getRampDirection(current, next);
    if (!dir) {
      continue;
    }

    if (heightA < heightB) {
      setRamp(cellA, dir, heightB - heightA);
    } else {
      setRamp(cellB, invertRampDirection(dir), heightA - heightB);
    }
  }
}

function getCellElevation(cell, fallback) {
  if (Number.isFinite(cell.elevation)) {
    return cell.elevation;
  }
  if (Number.isFinite(fallback)) {
    return fallback;
  }
  return 0;
}

function getRampDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "x+";
  if (dx === -1 && dy === 0) return "x-";
  if (dx === 0 && dy === 1) return "z+";
  if (dx === 0 && dy === -1) return "z-";
  return null;
}

function invertRampDirection(dir) {
  switch (dir) {
    case "x+":
      return "x-";
    case "x-":
      return "x+";
    case "z+":
      return "z-";
    case "z-":
      return "z+";
    default:
      return dir;
  }
}

function setRamp(cell, direction, rise) {
  if (!direction || !Number.isFinite(rise) || rise === 0) {
    return;
  }
  if (cell.rampDir && cell.rampDir !== direction) {
    return;
  }
  cell.rampUp = true;
  cell.rampDown = false;
  cell.rampDir = direction;
  cell.rampRise = Math.max(cell.rampRise ?? 0, rise);
}

function fillMissingElevations(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }
      if (!Number.isFinite(cell.elevation)) {
        cell.elevation = 0;
      }
    }
  }
}

function pickElevationStep(rng, min, max, step) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    return 0;
  }
  if (max <= min || step <= 0) {
    return min;
  }
  const stepCount = Math.round((max - min) / step);
  const value = min + randomInt(rng, 0, stepCount) * step;
  return quantize(value, step);
}

function quantize(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}

function sprinkleCover(grid, config, rng) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }
      cell.cover = rng() < config.coverProbability;
    }
  }
}

function buildPlatforms(grid, config, rng) {
  const targetPlatforms = config.platformsPerFloor;
  if (!targetPlatforms) {
    return 0;
  }

  let built = 0;
  let attempts = 0;
  const maxAttempts = targetPlatforms * 5;

  while (built < targetPlatforms && attempts < maxAttempts) {
    attempts += 1;
    const seed = pickPlatformSeed(grid, rng);
    if (!seed) {
      break;
    }

    const platformId = built;
    const platformSize = determinePlatformSize(grid, config, rng);
    const carved = growPlatformFromSeed(grid, seed, platformId, platformSize, rng);

    if (carved > 0) {
      built += 1;
    }
  }

  return built;
}

function placeSpawnPoints(grid, desiredCount, rng) {
  if (desiredCount <= 0) {
    return 0;
  }

  const height = grid.length;
  const width = grid[0].length;
  const candidates = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return 0;
  }

  const rngFn = typeof rng === "function" ? rng : Math.random;
  shuffleInPlace(candidates, rngFn);

  const chosen = [];

  for (const candidate of candidates) {
    let tooClose = false;
    for (const pick of chosen) {
      const dx = Math.abs(candidate.x - pick.x);
      const dy = Math.abs(candidate.y - pick.y);
      if (Math.max(dx, dy) < 5) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) {
      continue;
    }

    const cell = grid[candidate.y][candidate.x];
    if (cell.spawn) {
      continue;
    }

    cell.spawn = true;
    if (cell.cover) {
      cell.cover = false;
    }

    chosen.push(candidate);

    if (chosen.length >= desiredCount) {
      break;
    }
  }

  return chosen.length;
}

function determinePlatformSize(grid, config, rng) {
  const area = grid.length * grid[0].length;
  const maxRoom = config.maxRoomSize;
  const minCells = Math.max(3, Math.round(maxRoom * 0.35));
  const maxCells = Math.max(minCells + 2, Math.round(maxRoom * 1.4));
  const raw = randomFloat(rng, minCells, maxCells);
  return Math.min(Math.round(raw), Math.floor(area * 0.25));
}

function pickPlatformSeed(grid, rng) {
  const width = grid[0].length;
  const height = grid.length;
  const edgeCandidates = [];
  const fallbacks = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x];
      if (cell.solid || cell.platformId !== null || cell.roomId === null) {
        continue;
      }
      const edgeScore = countEdgeScore(grid, x, y);
      const candidate = { x, y, weight: edgeScore + 1 };
      if (edgeScore >= 2) {
        edgeCandidates.push(candidate);
      } else if (edgeScore >= 1) {
        fallbacks.push(candidate);
      }
    }
  }

  const pool =
    edgeCandidates.length > 0
      ? edgeCandidates
      : fallbacks.length > 0
      ? fallbacks
      : null;

  if (!pool || pool.length === 0) {
    return null;
  }

  const totalWeight = pool.reduce((sum, candidate) => sum + candidate.weight, 0);
  let threshold = rng() * totalWeight;

  for (const candidate of pool) {
    threshold -= candidate.weight;
    if (threshold <= 0) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  return { x: pool[0].x, y: pool[0].y };
}

function growPlatformFromSeed(grid, seed, platformId, targetSize, rng) {
  const width = grid[0].length;
  const height = grid.length;
  const queue = [{ x: seed.x, y: seed.y }];
  const carved = [];
  const visited = new Set();
  const minAcceptable = Math.max(3, Math.floor(targetSize * 0.5));

  while (queue.length > 0 && carved.length < targetSize) {
    const index = Math.floor(rng() * queue.length);
    const current = queue.splice(index, 1)[0];
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (!insideBounds(grid, current.x, current.y)) {
      continue;
    }

    const cell = grid[current.y][current.x];
    if (cell.solid || cell.platformId !== null || cell.roomId === null) {
      continue;
    }

    cell.platformId = platformId;
    carved.push({ x: current.x, y: current.y });

    const neighbors = getNeighbors4(current.x, current.y, width, height)
      .filter(({ x, y }) => {
        const neighbor = grid[y][x];
        return (
          !neighbor.solid &&
          neighbor.platformId === null &&
          neighbor.roomId !== null
        );
      })
      .sort(
        (a, b) => countEdgeScore(grid, b.x, b.y) - countEdgeScore(grid, a.x, a.y)
      );

    queue.push(...neighbors);
  }

  if (carved.length < minAcceptable) {
    for (const cell of carved) {
      grid[cell.y][cell.x].platformId = null;
    }
    return 0;
  }

  return carved.length;
}

function countEdgeScore(grid, x, y) {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  let score = 0;
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (!insideBounds(grid, nx, ny) || grid[ny][nx].solid) {
      score += 1;
    }
  }
  return score;
}

function getNeighbors4(x, y, width, height) {
  const neighbors = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < width - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < height - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
}

function applySymmetry(levels, config) {
  if (!levels.length || config.symmetry === "NONE") {
    return;
  }

  const keepTopHalf =
    config.symmetry === "X" ||
    config.symmetry === "XY" ||
    config.symmetry === "XY_POS";
  const keepBottomHalf =
    config.symmetry === "X_NEG" ||
    config.symmetry === "XY_NEG" ||
    config.symmetry === "XY_NEG_LEFT";
  const keepLeftHalf =
    config.symmetry === "Y" ||
    config.symmetry === "XY" ||
    config.symmetry === "XY_NEG_LEFT";
  const keepRightHalf =
    config.symmetry === "Y_POS" ||
    config.symmetry === "XY_POS" ||
    config.symmetry === "XY_NEG";

  for (const level of levels) {
    if (keepTopHalf) {
      mirrorAcrossHorizontalAxis(level.grid, true);
    } else if (keepBottomHalf) {
      mirrorAcrossHorizontalAxis(level.grid, false);
    }

    if (keepLeftHalf) {
      mirrorAcrossVerticalAxis(level.grid, true);
    } else if (keepRightHalf) {
      mirrorAcrossVerticalAxis(level.grid, false);
    }
  }
}

function mirrorAcrossHorizontalAxis(grid, keepTopHalf = true) {
  const height = grid.length;
  const width = grid[0].length;
  if (height <= 1) {
    return;
  }

  const source = grid.map((row) => row.map((cell) => cloneCell(cell)));

  for (let y = 0; y < height; y += 1) {
    const mirrorY = height - 1 - y;
    if (mirrorY < 0 || mirrorY >= height) {
      continue;
    }

    const isBottomHalf = y > mirrorY;
    const isTopHalf = y < mirrorY;

    if (keepTopHalf) {
      if (!isBottomHalf) {
        continue;
      }
    } else if (!keepTopHalf) {
      if (!isTopHalf) {
        continue;
      }
    }

    for (let x = 0; x < width; x += 1) {
      grid[y][x] = cloneCell(source[mirrorY][x]);
    }
  }
}

function mirrorAcrossVerticalAxis(grid, keepLeftHalf = true) {
  const height = grid.length;
  const width = grid[0].length;
  if (width <= 1) {
    return;
  }

  const source = grid.map((row) => row.map((cell) => cloneCell(cell)));

  for (let x = 0; x < width; x += 1) {
    const mirrorX = width - 1 - x;
    if (mirrorX < 0 || mirrorX >= width) {
      continue;
    }

    const isRightHalf = x > mirrorX;
    const isLeftHalf = x < mirrorX;

    if (keepLeftHalf) {
      if (!isRightHalf) {
        continue;
      }
    } else {
      if (!isLeftHalf) {
        continue;
      }
    }

    for (let y = 0; y < height; y += 1) {
      grid[y][x] = cloneCell(source[y][mirrorX]);
    }
  }
}

function cloneCell(cell) {
  return {
    solid: cell.solid,
    cover: cell.cover,
    rampUp: cell.rampUp,
    rampDown: cell.rampDown,
    rampDir: cell.rampDir,
    rampRise: cell.rampRise,
    platformId: cell.platformId,
    spawn: cell.spawn,
    roomId: cell.roomId,
    elevation: cell.elevation
  };
}

function insideBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value) {
  return clamp(value, 0, 1);
}





