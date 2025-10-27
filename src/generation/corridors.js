export const CORRIDOR_STRATEGIES = {
  L: generateLPath,
  Manhattan: generateManhattanPath,
  Bresenham: generateBresenhamPath,
  Spiral: generateSpiralPath,
  Radial: generateRadialPath
};

export function getCorridorPath(style, from, to, rng) {
  const strategy = CORRIDOR_STRATEGIES[style] ?? CORRIDOR_STRATEGIES.L;
  return strategy(from, to, rng);
}

function generateLPath(from, to, rng) {
  const path = [{ ...from }];
  const horizontalFirst = rng() > 0.5;

  if (horizontalFirst) {
    walkAxis(path, true, from.x, to.x, from.y);
    walkAxis(path, false, from.y, to.y, to.x);
  } else {
    walkAxis(path, false, from.y, to.y, from.x);
    walkAxis(path, true, from.x, to.x, to.y);
  }

  return dedupePath(path);
}

function generateManhattanPath(from, to, rng) {
  const path = [{ ...from }];
  let x = from.x;
  let y = from.y;

  while (x !== to.x || y !== to.y) {
    const dx = to.x - x;
    const dy = to.y - y;
    const takeHorizontal =
      Math.abs(dx) > Math.abs(dy)
        ? true
        : Math.abs(dx) === Math.abs(dy)
        ? rng() > 0.5
        : false;

    if (takeHorizontal && dx !== 0) {
      x += Math.sign(dx);
    } else if (dy !== 0) {
      y += Math.sign(dy);
    }

    path.push({ x, y });
  }

  return path;
}

function generateBresenhamPath(from, to) {
  const path = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    path.push({ x: x0, y: y0 });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return path;
}

function generateSpiralPath(from, to, rng) {
  const corePath = generateManhattanPath(from, to, rng);
  if (corePath.length <= 2) {
    return corePath;
  }

  const path = [{ ...corePath[0] }];
  const baseDistance = Math.max(
    Math.abs(to.x - from.x),
    Math.abs(to.y - from.y)
  );
  const maxRadius = Math.max(1, Math.min(6, Math.ceil(baseDistance / 2)));

  let radius = 1;
  let twistDir = rng() > 0.5 ? 1 : -1;

  for (let i = 1; i < corePath.length; i += 1) {
    const prev = corePath[i - 1];
    const current = corePath[i];
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const offsetMagnitude = Math.max(1, Math.min(maxRadius, radius));
    const offset = offsetMagnitude * twistDir;

    if (dx !== 0) {
      const sideY = prev.y + offset;
      walkAxis(path, false, prev.y, sideY, prev.x);
      walkAxis(path, true, prev.x, current.x, sideY);
      walkAxis(path, false, sideY, current.y, current.x);
    } else {
      const sideX = prev.x + offset;
      walkAxis(path, true, prev.x, sideX, prev.y);
      walkAxis(path, false, prev.y, current.y, sideX);
      walkAxis(path, true, sideX, current.x, current.y);
    }

    const last = path[path.length - 1];
    if (last.x !== current.x || last.y !== current.y) {
      path.push({ ...current });
    }

    if (i % 2 === 0) {
      radius += 1;
      twistDir = -twistDir;
    }
  }

  return dedupePath(path);
}

function generateRadialPath(from, to, rng) {
  const corePath = [];
  const hub = {
    x: Math.round((from.x + to.x) / 2),
    y: Math.round((from.y + to.y) / 2)
  };

  const spread = 2 + Math.floor(rng() * 3); // 2-4
  hub.x += randomOffset(spread, rng);
  hub.y += randomOffset(spread, rng);

  if (hub.x === from.x && hub.y === from.y) {
    hub.x += from.x === to.x ? (rng() > 0.5 ? 1 : -1) : Math.sign(to.x - from.x);
  }
  if (hub.x === to.x && hub.y === to.y) {
    hub.y += to.y === from.y ? (rng() > 0.5 ? 1 : -1) : Math.sign(from.y - to.y);
  }

  corePath.push(...generateManhattanPath(from, hub, rng));
  const tail = generateManhattanPath(hub, to, rng);
  corePath.push(...tail.slice(1));

  return dedupePath(corePath);
}

function walkAxis(path, isHorizontal, fromValue, toValue, fixed) {
  if (fromValue === toValue) {
    return;
  }

  const step = Math.sign(toValue - fromValue);

  for (
    let value = fromValue + step;
    value !== toValue + step;
    value += step
  ) {
    path.push(
      isHorizontal ? { x: value, y: fixed } : { x: fixed, y: value }
    );
  }
}

function dedupePath(path) {
  const result = [];
  let last = null;
  for (const point of path) {
    if (!last || last.x !== point.x || last.y !== point.y) {
      result.push(point);
      last = point;
    }
  }
  return result;
}

function randomOffset(max, rng) {
  if (max <= 0) {
    return 0;
  }
  const magnitude = Math.floor(rng() * (max + 1));
  if (magnitude === 0) {
    return 0;
  }
  return (rng() > 0.5 ? 1 : -1) * magnitude;
}
