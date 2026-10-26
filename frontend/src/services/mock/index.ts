import type { Services } from '../contracts'
import { createNotImplementedServices } from '../notImplemented'

// Placeholder: the mock store, seed data and latency arrive in #14, and the screens' methods in
// #15 and later. Until then every method rejects with a "not implemented" error.
// Only src/services/select.ts imports this file; screens use `services` from 'src/services'.
export const mockServices: Services = createNotImplementedServices(
  'mock',
  'the mock store is built in #14 and #18',
)
