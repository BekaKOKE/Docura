import type { Services } from '../contracts'
import { createNotImplementedServices } from '../notImplemented'

// Stub until M5 (#52): it makes no request and every method rejects with a "not implemented" error.
// Only src/services/select.ts imports this file; screens use `services` from 'src/services'.
export const httpServices: Services = createNotImplementedServices(
  'http',
  'the http client is built in M5, #52; use VITE_API_MODE=mock',
)
