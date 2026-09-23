export const BASE_SIZE = 10;
export const MIN_SIZE = 7;

/** Largest lyric size in [7, 10], in 0.25 pt steps, at which nothing overflows. Floor → { 7, fits:false }. */
export function fitScale(overflowsAt: (s: number) => boolean): { size: number; fits: boolean } {
  if (!overflowsAt(BASE_SIZE)) return { size: BASE_SIZE, fits: true };
  if (overflowsAt(MIN_SIZE)) return { size: MIN_SIZE, fits: false };
  // Search in quarter points: lo always fits, hi always overflows.
  let lo = MIN_SIZE * 4;
  let hi = BASE_SIZE * 4;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (overflowsAt(mid / 4)) hi = mid;
    else lo = mid;
  }
  return { size: lo / 4, fits: true };
}
