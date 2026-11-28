export type SeededRandom = () => number;

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state += 0x6d_2b_79_f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
