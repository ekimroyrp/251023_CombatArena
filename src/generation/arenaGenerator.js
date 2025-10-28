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
  const floorThickness = Math.max(0.5, config.cellSize * 0.1);
  const levelSpacing = config.wallHeight;

  const levels = [];

  for (let levelIndex = 0; levelIndex < config.floors; levelIndex += 1) {
    const levelSeed = `${config.seed}-L${levelIndex}`;
    const levelRng = createRng(levelSeed);
    const grid = createGrid(config.width, config.height);
    const rooms = carveRooms(grid, config, levelRng);

    if (rooms.length === 0) {
      const fallback = createFallbackRoom(config);
      paintRoom(grid, fallback);
      rooms.push(fallback);
    }

    connectRooms(grid, rooms, config, levelRng);
    sprinkleCover(grid, config, createRng(`${config.seed}-cover-${levelIndex}-${config.coverSeed}`));
    const platformRng = createRng(
      `${config.seed}-platform-${config.platformSeed}-L${levelIndex}`
    );
    const platformCount = buildPlatforms(grid, config, platformRng);

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
    floorThickness,
    platformThickness: config.platformThickness,
    levelSpacing,
    levels
  };
}

function normalizeOptions(options) {
  const width = clamp(Math.floor(options.gridWidth ?? 32), 8, 96);
  const height = clamp(Math.floor(options.gridHeight ?? 24), 8, 96);
  const maxRoomSize = clamp(Math.floor(options.maxRoomSize ?? 8), 3, 24);

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
  const allowedSym = new Set(["NONE", "X", "Y", "XY"]);
  const symmetry = allowedSym.has(symmetryRaw) ? symmetryRaw : "NONE";

  const rawSeed = clamp(Math.floor(options.seed ?? 0), 1, 1000);
  const platformSeed = clamp(Math.floor(options.platformSeed ?? 0), 0, 999);
  const coverSeed = clamp(Math.floor(options.coverSeed ?? 1), 1, 1000);
  const platformThickness = clamp(
    Number.isFinite(options.platformThickness) ? options.platformThickness : 0.25,
    0.25,
    10
  );
  const basePlatforms = clamp(Math.floor(options.platforms ?? 0), 0, 20);
  const platformsPerFloor = clamp(
    Math.round(basePlatforms * (styleProfile.verticality ?? 1)),
    0,
    20
  );

  const coverProbability = clamp01(
    ((options.coverProbability ?? 10.0) * 0.01) * (styleProfile.coverBias ?? 1)
  );

  const corridorStyle =
    options.corridorStyle ?? styleProfile.corridorStyle ?? "L";

  return {
    seed: String(rawSeed),
    coverSeed: String(coverSeed),
    type,
    styleProfile,
    width,
    height,
    cellSize: clamp(options.cellSize ?? 4, 1, 10),
    rooms,
    floors,
    platformsPerFloor,
    platformSeed,
    platformThickness,
    symmetry,
    maxRoomSize: Math.min(maxRoomSize, width - 2, height - 2),
    corridorStyle,
    styleCorridor: styleProfile.corridorStyle ?? corridorStyle,
    corridorBlend: clamp01(styleProfile.corridorBlend ?? 0),
    corridorPadding: Math.max(0, Math.round(styleProfile.corridorPadding ?? 1)),
    carveDiagonals: Boolean(styleProfile.carveDiagonals),
    longRoomBias: clamp01(styleProfile.longRoomBias ?? 0.5),
    rectangularity: Math.max(1, styleProfile.rectangularity ?? 1),
    atriumChance: clamp01(styleProfile.atriumChance ?? 0),
    coverProbability,
    wallHeight: clamp(options.wallHeight ?? 2, 1, 16),
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
      platformId: null
    }))
  );
}

function carveRooms(grid, config, rng) {
  const rooms = [];
  const attemptsLimit = config.rooms * 12;
  let attempts = 0;

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

    widthLimit = Math.max(3, widthLimit);
    heightLimit = Math.max(3, heightLimit);

    const roomWidth = clamp(
      randomInt(rng, 3, widthLimit),
      3,
      config.width - 2
    );
    const roomHeight = clamp(
      randomInt(rng, 3, heightLimit),
      3,
      config.height - 2
    );
    const x = randomInt(rng, 1, Math.max(1, config.width - roomWidth - 1));
    const y = randomInt(rng, 1, Math.max(1, config.height - roomHeight - 1));

    if (!roomFits(grid, x, y, roomWidth, roomHeight)) {
      continue;
    }

    const room = {
      x,
      y,
      width: roomWidth,
      height: roomHeight
    };
    paintRoom(grid, room);
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

function addRoomCenter(room) {
  return {
    ...room,
    center: {
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2)
    }
  };
}

function paintRoom(grid, room) {
  for (let dy = 0; dy < room.height; dy += 1) {
    for (let dx = 0; dx < room.width; dx += 1) {
      grid[room.y + dy][room.x + dx].solid = false;
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

    carveCorridor(
      grid,
      bestPair.source.center,
      bestPair.target.center,
      config,
      rng
    );

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
    carveCorridor(grid, a.center, b.center, config, rng);
  }
}

function carveCorridor(grid, from, to, config, rng) {
  let corridorStyle = config.corridorStyle;
  if (
    config.styleCorridor &&
    config.styleCorridor !== corridorStyle &&
    typeof rng === "function" &&
    rng() < config.corridorBlend
  ) {
    corridorStyle = config.styleCorridor;
  }

  const path = getCorridorPath(corridorStyle, from, to, rng);
  const padding = Math.max(0, config.corridorPadding ?? 1);

  for (const point of path) {
    if (!insideBounds(grid, point.x, point.y)) {
      continue;
    }
    grid[point.y][point.x].solid = false;

    // Soften hard diagonals by carving a plus-shaped footprint.
    carvePadding(grid, point.x, point.y, padding, config.carveDiagonals);
  }
}

function carvePadding(grid, x, y, radius, includeDiagonals) {
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
        grid[ny][nx].solid = false;
      }
    }
  }
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
      if (cell.solid || cell.platformId !== null) {
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
    if (cell.solid || cell.platformId !== null) {
      continue;
    }

    cell.platformId = platformId;
    cell.cover = false;
    carved.push({ x: current.x, y: current.y });

    const neighbors = getNeighbors4(current.x, current.y, width, height)
      .filter(({ x, y }) => {
        const neighbor = grid[y][x];
        return !neighbor.solid && neighbor.platformId === null;
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

  const applyX = config.symmetry === "X" || config.symmetry === "XY";
  const applyY = config.symmetry === "Y" || config.symmetry === "XY";

  for (const level of levels) {
    if (applyX) {
      mirrorAcrossHorizontalAxis(level.grid);
    }
    if (applyY) {
      mirrorVertical(level.grid);
    }
  }
}

function mirrorAcrossHorizontalAxis(grid) {
  const height = grid.length;
  const width = grid[0].length;
  if (height <= 1) {
    return;
  }

  const source = grid.map((row) => row.map((cell) => cloneCell(cell)));
  const hasCenterRow = height % 2 === 1;
  const pivot = Math.floor(height / 2);
  const startMirror = hasCenterRow ? pivot + 1 : pivot;

  for (let y = startMirror; y < height; y += 1) {
    const mirrorY = hasCenterRow
      ? pivot - (y - pivot)
      : pivot - 1 - (y - pivot);
    if (mirrorY < 0 || mirrorY >= height) {
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      grid[y][x] = cloneCell(source[mirrorY][x]);
    }
  }
}

function mirrorVertical(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const original = grid.map((row) => row.map((cell) => cloneCell(cell)));
  const limit = Math.ceil(width / 2);

  for (let x = 0; x < limit; x += 1) {
    const mirrorX = width - 1 - x;
    for (let y = 0; y < height; y += 1) {
      const combined = combineCells(original[y][x], original[y][mirrorX]);
      grid[y][x] = combined;

      if (mirrorX !== x) {
        grid[y][mirrorX] = cloneCell(combined);
      }
    }
  }
}

function cloneCell(cell) {
  return {
    solid: cell.solid,
    cover: cell.cover,
    rampUp: cell.rampUp,
    rampDown: cell.rampDown,
    platformId: cell.platformId
  };
}

function combineCells(a, b) {
  const solid = a.solid && b.solid;
  const cover = !solid && (a.cover || b.cover);
  const rampUp = !solid && (a.rampUp || b.rampUp);
  const rampDown = !solid && (a.rampDown || b.rampDown);
  const platformId = solid ? null : a.platformId ?? b.platformId;

  return {
    solid,
    cover,
    rampUp,
    rampDown,
    platformId
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


