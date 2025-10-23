import { getCorridorPath } from "./corridors.js";
import { createRng, randomInt, shuffleInPlace } from "../utils/random.js";

const STYLE_PROFILES = {
  Halo: {
    roomDensity: 1.0,
    verticality: 1.3,
    loopFactor: 1.2,
    rampBias: 1.5,
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
    rampBias: 0.6,
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
    rampBias: 1.9,
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
    sprinkleCover(grid, config, levelRng);

    levels.push({
      index: levelIndex,
      elevation: levelIndex * levelSpacing,
      width: config.width,
      height: config.height,
      grid,
      rooms
    });
  }

  linkFloorsWithRamps(levels, config);

  return {
    cellSize: config.cellSize,
    wallHeight: config.wallHeight,
    floorThickness,
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
  const floors = clamp(
    Math.round(baseFloors * (styleProfile.verticality ?? 1)),
    1,
    8
  );

  const coverProbability = clamp01(
    (options.coverProbability ?? 0.1) * (styleProfile.coverBias ?? 1)
  );
  const rampProbability = clamp01(
    (options.rampProbability ?? 0.05) * (styleProfile.rampBias ?? 1)
  );

  const corridorStyle =
    options.corridorStyle ?? styleProfile.corridorStyle ?? "L";

  return {
    seed: options.seed ?? "0",
    type,
    styleProfile,
    width,
    height,
    cellSize: clamp(options.cellSize ?? 4, 1, 10),
    rooms,
    floors,
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
    rampProbability,
    wallHeight: clamp(options.wallHeight ?? 6, 2, 16),
    loopFactor: Math.max(0, styleProfile.loopFactor ?? 1)
  };
}

function createGrid(width, height) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      solid: true,
      cover: false,
      rampUp: false,
      rampDown: false
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

function linkFloorsWithRamps(levels, config) {
  if (levels.length <= 1) {
    return;
  }

  for (let i = 0; i < levels.length - 1; i += 1) {
    const lower = levels[i];
    const upper = levels[i + 1];
    const linkRng = createRng(`${config.seed}-link-${i}`);
    const candidates = [];

    for (let y = 0; y < lower.height; y += 1) {
      for (let x = 0; x < lower.width; x += 1) {
        if (!lower.grid[y][x].solid && !upper.grid[y][x].solid) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) {
      // Create a fallback corridor column if the upper level is missing coverage here.
      const fallback = lower.rooms[0]?.center ?? {
        x: Math.floor(lower.width / 2),
        y: Math.floor(lower.height / 2)
      };
      if (insideBounds(lower.grid, fallback.x, fallback.y)) {
        lower.grid[fallback.y][fallback.x].solid = false;
        upper.grid[fallback.y][fallback.x].solid = false;
        candidates.push(fallback);
      }
    }

    if (candidates.length === 0) {
      continue;
    }

    shuffleInPlace(candidates, linkRng);
    const desired = Math.round(candidates.length * config.rampProbability);
    const count = Math.min(
      candidates.length,
      Math.max(1, desired)
    );

    for (let c = 0; c < count; c += 1) {
      const cell = candidates[c];
      lower.grid[cell.y][cell.x].rampUp = true;
      upper.grid[cell.y][cell.x].rampDown = true;
    }
  }
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
