// Cyclically-unique binary numbers, per "The Theory of Magic".
//
// A length-n binary string and all its rotations represent the SAME rune (just
// turned). To give every feature a unique, rotationally-unambiguous symbol we
// keep one representative per rotation class (the lexicographically smallest),
// then sort them. The k-th feature of an attribute uses the k-th entry.

const cache = new Map<number, number[][]>();

function rotations(bits: number[]): number[][] {
  const n = bits.length;
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    out.push(bits.map((_, i) => bits[(i + r) % n]));
  }
  return out;
}

function lexCompare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** All cyclically-unique binary numbers of length n, sorted ascending. */
export function uniqueBinaries(n: number): number[][] {
  const hit = cache.get(n);
  if (hit) return hit;

  const seen = new Set<string>();
  const result: number[][] = [];
  const total = 2 ** n;
  for (let x = 0; x < total; x++) {
    const bits: number[] = [];
    for (let i = 0; i < n; i++) bits.push((x >> (n - 1 - i)) & 1);
    let canon = bits;
    for (const rot of rotations(bits)) {
      if (lexCompare(rot, canon) < 0) canon = rot;
    }
    const key = canon.join('');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(canon);
    }
  }
  result.sort(lexCompare);
  cache.set(n, result);
  return result;
}

/** Smallest odd n that fits `attributeCount` layers AND `maxFeatures` symbols. */
export function chooseN(attributeCount: number, maxFeatures: number): number {
  let n = 2 * attributeCount + 1;
  if (n % 2 === 0) n += 1;
  while (uniqueBinaries(n).length < maxFeatures) {
    n += 2;
  }
  return n;
}
