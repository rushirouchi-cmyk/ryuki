/** Deterministic PRNG so every `npm run db:seed` produces the same dataset. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    chance: (probability: number) => next() < probability,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("pick from empty array");
      return item;
    },
    sample: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const picked: T[] = [];
      while (picked.length < count && pool.length > 0) {
        const index = Math.floor(next() * pool.length);
        const [item] = pool.splice(index, 1);
        if (item !== undefined) picked.push(item);
      }
      return picked;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;
