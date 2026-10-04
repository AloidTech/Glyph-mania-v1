/**
 * @file tick_engine.ts
 * @description Engine-Wide Discrete Tick Standard.
 * Removes floating-point drift and unifies all time intervals.
 * All durations, periodic ticks, and entity lifetimes are expressed in
 * discrete game ticks (1 tick = Δt).
 *
 * TICK_RATE = 10 Hz  (Δt = 0.10s = 100ms per tick)
 */

export const GAME_TICK_CONFIG = {
  TICK_HZ: 10,
  TICK_DELTA_SEC: 0.10, // 1 tick = 100ms
} as const;

/** Convert seconds to discrete tick count. Always returns at least 1 tick. */
export function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds / GAME_TICK_CONFIG.TICK_DELTA_SEC));
}

/** Convert tick count back to seconds. */
export function ticksToSeconds(ticks: number): number {
  return ticks * GAME_TICK_CONFIG.TICK_DELTA_SEC;
}
