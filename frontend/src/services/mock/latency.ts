// Every mock call takes 150 to 400 ms, so loading states are visible (#14 AC 2).

export const LATENCY_MIN_MS = 150
export const LATENCY_MAX_MS = 400

/** Waits `ms` milliseconds. Tests pass their own. */
export type Sleep = (ms: number) => Promise<void>

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A latency in [150, 400] ms. `random` returns [0, 1) like `Math.random`. */
export function pickLatency(random: () => number = Math.random): number {
  return Math.round(LATENCY_MIN_MS + random() * (LATENCY_MAX_MS - LATENCY_MIN_MS))
}
