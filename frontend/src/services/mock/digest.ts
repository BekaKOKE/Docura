// A synchronous 256-bit hex digest for the mock's signature evidence (`imageSha256`, `documentSha256`).
//
// This is NOT SHA-256. `crypto.subtle` is missing on plain http (the phone opens the dev server over the LAN,
// AGENTS.md), and the mock only needs a value that looks like the backend's and changes when its input changes.
// Eight 32-bit FNV-1a lanes with different seeds, mixed at the end, over the UTF-8 bytes of the text.

const LANES = 8
const SEEDS = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c]

export function mockDigest(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const lanes = SEEDS.slice(0, LANES).map((seed) => seed >>> 0)
  for (let i = 0; i < bytes.length; i++) {
    for (let lane = 0; lane < LANES; lane++) {
      // Each lane sees the byte with a different offset, so the lanes don't repeat each other.
      lanes[lane] = Math.imul((lanes[lane]! ^ ((bytes[i]! + lane * 31) & 0xff)) >>> 0, 0x01000193) >>> 0
    }
  }
  // Final avalanche, each lane also takes in its neighbour so one changed byte spreads over the whole value.
  for (let round = 0; round < 2; round++) {
    for (let lane = 0; lane < LANES; lane++) {
      let h = (lanes[lane]! ^ lanes[(lane + 1) % LANES]!) >>> 0
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
      lanes[lane] = (h ^ (h >>> 16)) >>> 0
    }
  }
  return lanes.map((lane) => lane.toString(16).padStart(8, '0')).join('')
}

/** JSON with the keys sorted at every level, so the same data always gives the same text (and the same digest). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortKeys(item)]),
    )
  }
  return value
}
