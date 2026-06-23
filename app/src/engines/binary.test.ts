import { describe, it, expect } from 'vitest';
import { uniqueBinaries, chooseN } from './binary';

describe('uniqueBinaries(n)', () => {
  it('n=1: two entries [0] and [1]', () => {
    const bins = uniqueBinaries(1);
    expect(bins).toHaveLength(2);
    expect(bins[0]).toEqual([0]);
    expect(bins[1]).toEqual([1]);
  });

  it('n=3: 4 cyclically-unique entries', () => {
    // 000, 001, 011, 111  (100 and 010 are rotations of 001; 110 and 101 of 011)
    const bins = uniqueBinaries(3);
    expect(bins).toHaveLength(4);
  });

  it('n=13: at least 632 entries (enough for 19 features across 6 attributes)', () => {
    const bins = uniqueBinaries(13);
    expect(bins.length).toBeGreaterThanOrEqual(632);
  });

  it('all entries are canonical (no rotation is lex-smaller)', () => {
    const bins = uniqueBinaries(7);
    for (const b of bins) {
      const n = b.length;
      for (let r = 1; r < n; r++) {
        const rot = [...b.slice(r), ...b.slice(0, r)];
        // canonical means b <= every rotation lexicographically
        const cmp = b.findIndex((v, i) => v !== rot[i]);
        if (cmp !== -1) {
          expect(b[cmp]).toBeLessThanOrEqual(rot[cmp]);
        }
      }
    }
  });

  it('no two entries are rotations of each other', () => {
    const bins = uniqueBinaries(7);
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const n = b.length;
      for (let r = 1; r < n; r++) {
        const rot = [...b.slice(r), ...b.slice(0, r)];
        // rotation should not appear as a separate entry
        const found = bins.findIndex((c, j) => j !== i && c.every((v, k) => v === rot[k]));
        expect(found).toBe(-1);
      }
    }
  });

  it('result is sorted lexicographically', () => {
    const bins = uniqueBinaries(5);
    for (let i = 1; i < bins.length; i++) {
      const a = bins[i - 1];
      const b = bins[i];
      const n = a.length;
      let cmp = -1;
      for (let k = 0; k < n; k++) {
        if (a[k] !== b[k]) { cmp = k; break; }
      }
      if (cmp !== -1) expect(a[cmp]).toBeLessThan(b[cmp]);
    }
  });
});

describe('chooseN', () => {
  it('returns 13 for 6 attributes and 19 max features (the compendium config)', () => {
    expect(chooseN(6, 19)).toBe(13);
  });

  it('always returns an odd number', () => {
    for (const [attrs, features] of [[3, 5], [4, 10], [6, 19], [5, 15]] as const) {
      expect(chooseN(attrs, features) % 2).toBe(1);
    }
  });

  it('the result has enough unique binaries for maxFeatures', () => {
    const n = chooseN(6, 19);
    expect(uniqueBinaries(n).length).toBeGreaterThanOrEqual(19);
  });
});
