// Error injection: force an ApiError code on the next call(s), so every error state can be built and looked
// at (docs/architecture "Rules for the mock", 2). It is a development tool: the runtime only reads it under
// `import.meta.env.DEV`, so it is not in the production build (#14 AC 5).

import { t } from '../../i18n/t'
import { ApiError, type ApiErrorCode } from '../errors'

export interface ForcedError {
  code: ApiErrorCode
  /** How many more calls get this error. */
  remaining: number
}

export interface ErrorInjector {
  /** The next `times` calls (default 1) fail with `code`, after the ones already queued. */
  force(code: ApiErrorCode, times?: number): void
  /** Forgets every queued error. */
  clear(): void
  /** The queue, in the order it will fire. A new array after every change, so it works as a snapshot. */
  pending(): readonly ForcedError[]
  /** Used by a mock call: the error to raise now, or null. Consumes one forced call. */
  take(): ApiError | null
  /** Called after every change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export function createErrorInjector(): ErrorInjector {
  let queue: readonly ForcedError[] = []
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }

  return {
    force(code, times = 1) {
      if (!Number.isInteger(times) || times < 1) throw new RangeError('times must be a positive integer')
      queue = [...queue, { code, remaining: times }]
      notify()
    },

    clear() {
      if (queue.length === 0) return
      queue = []
      notify()
    },

    pending: () => queue,

    take() {
      const [first, ...rest] = queue
      if (!first) return null
      queue = first.remaining > 1 ? [{ ...first, remaining: first.remaining - 1 }, ...rest] : rest
      notify()
      return new ApiError({ code: first.code, message: t(`apiError.${first.code}`) })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
