import seedrandom from "seedrandom";

export function createRng(seed) {
  const rng = seedrandom(seed ?? undefined);
  return () => rng();
}

export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(rng, min, max) {
  return rng() * (max - min) + min;
}
