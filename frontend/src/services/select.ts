import type { Services } from './contracts'
import { httpServices } from './http'
import { mockServices } from './mock'

export const API_MODES = ['mock', 'http'] as const
export type ApiMode = (typeof API_MODES)[number]

/** `VITE_API_MODE`: `mock` (also when unset or empty) or `http`. Anything else is a typo and fails loudly. */
export function resolveApiMode(value: string | undefined): ApiMode {
  const mode = (value ?? '').trim().toLowerCase()
  if (mode === '') return 'mock'
  if ((API_MODES as readonly string[]).includes(mode)) return mode as ApiMode
  throw new Error(`VITE_API_MODE must be "mock" or "http", got "${value}"`)
}

export function selectServices(value: string | undefined): Services {
  return resolveApiMode(value) === 'http' ? httpServices : mockServices
}
