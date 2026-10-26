// What every mock service method runs inside: `runtime.call(fn)` waits 150-400 ms (a real network is never
// instant), then raises a forced error if the dev panel queued one, then runs `fn` against the store.

import { createErrorInjector, type ErrorInjector } from './errorInjection'
import { pickLatency, realSleep, type Sleep } from './latency'
import { createStore, STORAGE_KEY, type MockStore } from './store'

export interface CallOptions {
  /** False for a method that never fails by contract (`auth.logout`): it still takes its time. Default true. */
  injectable?: boolean
}

export interface MockRuntime {
  readonly store: MockStore
  /** Only in development builds; undefined in production. */
  readonly injector: ErrorInjector | undefined
  call<T>(fn: () => T | Promise<T>, options?: CallOptions): Promise<T>
  /** Current time. The one clock the mock uses (timestamps, rate limits), so tests can set it. */
  now(): Date
}

export interface RuntimeDeps {
  store: MockStore
  /** Present only in development builds (see `createBrowserRuntime`). */
  injector?: ErrorInjector
  sleep?: Sleep
  random?: () => number
  now?: () => Date
}

export function createMockRuntime(deps: RuntimeDeps): MockRuntime {
  const sleep = deps.sleep ?? realSleep
  const injector = deps.injector
  return {
    store: deps.store,
    injector,
    now: deps.now ?? (() => new Date()),
    async call(fn, options) {
      await sleep(pickLatency(deps.random))
      // The injector exists only in development builds; in production this branch is removed.
      if (import.meta.env.DEV && options?.injectable !== false) {
        const forced = injector?.take()
        if (forced) throw forced
      }
      return fn()
    },
  }
}

let browserRuntime: MockRuntime | undefined

/** The runtime of the running app: localStorage, real timers. Created on first use, so importing `services` has no side effects. */
export function getMockRuntime(): MockRuntime {
  if (!browserRuntime) {
    const store = createStore()
    browserRuntime = createMockRuntime({
      store,
      injector: import.meta.env.DEV ? createErrorInjector() : undefined,
    })
    // Another tab saved (a client signed on /p/:token, a reset): this tab follows.
    globalThis.addEventListener?.('storage', (event) => {
      const e = event as StorageEvent
      if (e.key === STORAGE_KEY || e.key === null) store.reload()
    })
  }
  return browserRuntime
}
