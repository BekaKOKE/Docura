// The services layer: the only way screens get data (AGENTS.md rule 1).
//   import { services, ApiError } from '../services'
// `services` is the mock by default; VITE_API_MODE=http selects the http implementation (M5, #52).
// Import from here only, never from './mock' or './http' (checked by boundary.test.ts).

import type { Services } from './contracts'
import { selectServices } from './select'

export const services: Services = selectServices(import.meta.env.VITE_API_MODE)

export { API_MODES, resolveApiMode, selectServices } from './select'
export type { ApiMode } from './select'
export { NotImplementedError } from './notImplemented'
// For the development panel only (src/dev); nothing else uses these, and the production build drops them.
export {
  clearForcedErrors,
  devLogins,
  forceNextError,
  getDevSnapshot,
  mockDevtoolsEnabled,
  resetMockData,
  subscribeDevtools,
} from './devtools'
export type { DevLogin, DevSession, DevSnapshot, ForcedError } from './devtools'
export { API_ERROR_CODES, API_ERROR_STATUS, ApiError, isApiError, isApiErrorCode } from './errors'
export type { ApiErrorCode, ApiErrorInit, ApiFieldErrors } from './errors'
export type * from './contracts'
export type * from './types'
