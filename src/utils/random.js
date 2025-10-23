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

export function shuffleInPlace(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
