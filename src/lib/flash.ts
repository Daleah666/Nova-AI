export const HARD_MAX_HZ = 3;
export const DEFAULT_HZ = 0.5;
export const MIN_HZ = 0.1;

export function clampHz(hz: number): number {
  if (!Number.isFinite(hz)) return DEFAULT_HZ;
  return Math.min(HARD_MAX_HZ, Math.max(MIN_HZ, hz));
}

export function hzToIntervalMs(hz: number): number {
  return Math.round(1000 / clampHz(hz));
}

export function intervalToHz(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_HZ;
  return clampHz(1000 / ms);
}

/** Hard floor so a buggy caller cannot schedule faster than ~3 Hz. */
export function clampIntervalMs(ms: number): number {
  const minMs = Math.round(1000 / HARD_MAX_HZ);
  if (!Number.isFinite(ms)) return hzToIntervalMs(DEFAULT_HZ);
  return Math.max(minMs, Math.round(ms));
}
