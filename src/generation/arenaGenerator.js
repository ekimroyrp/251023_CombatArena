import { getCorridorPath } from "./corridors.js";
import { createRng, randomInt } from "../utils/random.js";

export function generateArenaLayout(options) {
  const config = normalizeOptions(options);
  const rng = createRng(config.seed);

  const grid = createGrid(config.width, config.height);
  const rooms = carveRooms(grid, config, rng);

  if (rooms.length === 0) {
    const fallback = createFallbackRoom(config);
    paintRoom(grid, fallback);
    rooms.push(fallback);
  }

  connectRooms(grid, rooms, config, rng);
  sprinkleProps(grid, config, rng);

  return {
    width: config.width,
    height: config.height,
    cellSize: config.cellSize,
    wallHeight: config.wallHeight,
    rooms,
    grid
  };
}

function normalizeOptions(options) {
  const width = clamp(Math.floor(options.gridWidth ?? 32), 8, 96);
  const height = clamp(Math.floor(options.gridHeight ?? 24), 8, 96);
  const maxRoomSize = clamp(Math.floor(options.maxRoomSize ?? 8), 3, 24);
  const rooms = clamp(Math.floor(options.rooms ?? 10), 1, 96);

  return {
    seed: options.seed ?? "0",
    width,
    height,
    cellSize: clamp(options.cellSize ?? 4, 1, 10),
    rooms,
    maxRoomSize: Math.min(maxRoomSize, width - 2, height - 2),
    corridorStyle: options.corridorStyle ?? "L",
    coverProbability: clamp01(options.coverProbability ?? 0.1),
    rampProbability: clamp01(options.rampProbability ?? 0.05),
    wallHeight: clamp(options.wallHeight ?? 6, 2, 16)
  };
}

function createGrid(width, height) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      solid: true,
      cover: false,
      ramp: false
    }))
  );
}

function carveRooms(grid, config, rng) {
  const rooms = [];
  const attemptsLimit = config.rooms * 12;
  let attempts = 0;

  while (rooms.length < config.rooms && attempts < attemptsLimit) {
    attempts += 1;

    const roomWidth = clamp(
      randomInt(rng, 3, config.maxRoomSize),
      3,
      config.width - 2
    );
    const roomHeight = clamp(
      randomInt(rng, 3, config.maxRoomSize),
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
        const distance = Math.abs(source.center.x - target.center.x) ** 2 +
          Math.abs(source.center.y - target.center.y) ** 2;
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

  // Add a couple of extra loops to avoid linear levels.
  for (let i = 0; i < Math.min(rooms.length / 3, 3); i += 1) {
    const a = rooms[randomInt(rng, 0, rooms.length - 1)];
    const b = rooms[randomInt(rng, 0, rooms.length - 1)];
    if (a === b) {
      continue;
    }
    carveCorridor(grid, a.center, b.center, config, rng);
  }
}

function carveCorridor(grid, from, to, config, rng) {
  const path = getCorridorPath(config.corridorStyle, from, to, rng);

  for (const point of path) {
    if (!insideBounds(grid, point.x, point.y)) {
      continue;
    }
    grid[point.y][point.x].solid = false;

    // Soften hard diagonals by carving a plus-shaped footprint.
    carvePadding(grid, point.x, point.y);
  }
}

function carvePadding(grid, x, y) {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (insideBounds(grid, nx, ny)) {
      grid[ny][nx].solid = false;
    }
  }
}

function sprinkleProps(grid, config, rng) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = grid[y][x];
      if (cell.solid) {
        continue;
      }

      cell.cover = false;
      cell.ramp = false;

      if (rng() < config.coverProbability) {
        cell.cover = true;
      } else if (rng() < config.rampProbability) {
        cell.ramp = true;
      }
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
