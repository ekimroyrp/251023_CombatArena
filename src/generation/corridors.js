export const CORRIDOR_STRATEGIES = {
  L: generateLPath,
  Manhattan: generateManhattanPath,
  Bresenham: generateBresenhamPath
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
