import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES, API_ERROR_STATUS, ApiError } from '../errors'
import { createErrorInjector } from './errorInjection'
import { LATENCY_MAX_MS, LATENCY_MIN_MS, pickLatency } from './latency'
import { createMockRuntime } from './runtime'
import { createStore } from './store'

afterEach(() => {
  vi.useRealTimers()
})

describe('latency (AC 2)', () => {
  it('is 150 to 400 ms at both ends of the random range', () => {
    expect(LATENCY_MIN_MS).toBe(150)
    expect(LATENCY_MAX_MS).toBe(400)
    expect(pickLatency(() => 0)).toBe(150)
    expect(pickLatency(() => 0.5)).toBe(275)
    expect(pickLatency(() => 0.999999)).toBe(400)
  })

  it('always picks inside the range', () => {
    for (let i = 0; i < 1000; i += 1) {
      const ms = pickLatency()
      expect(ms).toBeGreaterThanOrEqual(150)
      expect(ms).toBeLessThanOrEqual(400)
    }
  })

  it('holds a call back for the picked time with fake timers, and not a tick less', async () => {
    vi.useFakeTimers()
    const runtime = createMockRuntime({ store: createStore({ storage: null }), random: () => 0 })
    const fn = vi.fn(() => 'done')
    const result = runtime.call(fn)
    await vi.advanceTimersByTimeAsync(149)
    expect(fn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBe('done')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('takes 150 to 400 ms for 50 calls with real timers', async () => {
    const runtime = createMockRuntime({ store: createStore({ storage: null }) })
    const durations = await Promise.all(
      Array.from({ length: 50 }, async () => {
        const start = performance.now()
        await runtime.call(() => undefined)
        return performance.now() - start
      }),
    )
    // setTimeout may fire a millisecond early and a busy machine fires late: 3 ms below, 40 ms above.
    // The exact bounds are proved with fake timers above.
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(LATENCY_MIN_MS - 3)
      expect(ms).toBeLessThanOrEqual(LATENCY_MAX_MS + 40)
    }
    expect(new Set(durations.map(Math.round)).size).toBeGreaterThan(5)
  })

  it('also delays a call that fails, so the loading state shows before the error', async () => {
    vi.useFakeTimers()
    const runtime = createMockRuntime({ store: createStore({ storage: null }), random: () => 0 })
    const failure = runtime.call(() => {
      throw new ApiError({ code: 'not_found', message: 'x' })
    })
    const settled = vi.fn()
    failure.catch(settled)
    await vi.advanceTimersByTimeAsync(100)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(50)
    expect(settled).toHaveBeenCalledTimes(1)
  })
})

describe('error injection (AC 3)', () => {
  const instant = async () => {}

  function setup() {
    const injector = createErrorInjector()
    const runtime = createMockRuntime({ store: createStore({ storage: null }), injector, sleep: instant })
    return { injector, runtime }
  }

  it.each(API_ERROR_CODES)('forces %s on the next call, with its status and a Russian message', async (code) => {
    const { injector, runtime } = setup()
    const fn = vi.fn()
    injector.force(code)
    const error = await runtime.call(fn).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code, status: API_ERROR_STATUS[code] })
    expect((error as ApiError).message).toMatch(/[А-Яа-яЁё]/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('fires once and then calls work normally', async () => {
    const { injector, runtime } = setup()
    injector.force('version_conflict')
    await expect(runtime.call(() => 'x')).rejects.toMatchObject({ code: 'version_conflict' })
    await expect(runtime.call(() => 'x')).resolves.toBe('x')
    expect(injector.pending()).toEqual([])
  })

  it('fires for the next N calls, then stops', async () => {
    const { injector, runtime } = setup()
    injector.force('rate_limited', 2)
    expect(injector.pending()).toEqual([{ code: 'rate_limited', remaining: 2 }])
    await expect(runtime.call(() => 1)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(injector.pending()).toEqual([{ code: 'rate_limited', remaining: 1 }])
    await expect(runtime.call(() => 1)).rejects.toMatchObject({ code: 'rate_limited' })
    await expect(runtime.call(() => 1)).resolves.toBe(1)
  })

  it('queues different codes in the order they were forced', async () => {
    const { injector, runtime } = setup()
    injector.force('unauthorized')
    injector.force('not_found')
    await expect(runtime.call(() => 1)).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(runtime.call(() => 1)).rejects.toMatchObject({ code: 'not_found' })
    await expect(runtime.call(() => 1)).resolves.toBe(1)
  })

  it('can be cleared before it fires', async () => {
    const { injector, runtime } = setup()
    injector.force('overpayment', 3)
    injector.clear()
    await expect(runtime.call(() => 1)).resolves.toBe(1)
  })

  it('leaves a method that never fails by contract alone', async () => {
    const { injector, runtime } = setup()
    injector.force('unauthorized')
    await expect(runtime.call(() => 'out', { injectable: false })).resolves.toBe('out')
    expect(injector.pending()).toHaveLength(1)
  })

  it('does nothing without an injector (the production build has none)', async () => {
    const runtime = createMockRuntime({ store: createStore({ storage: null }), sleep: instant })
    await expect(runtime.call(() => 'x')).resolves.toBe('x')
  })

  it('refuses a count that is not a positive integer', () => {
    const { injector } = setup()
    expect(() => injector.force('not_found', 0)).toThrow(RangeError)
    expect(() => injector.force('not_found', 1.5)).toThrow(RangeError)
  })

  it('tells subscribers about every change, and a new queue array each time', () => {
    const { injector } = setup()
    const listener = vi.fn()
    const off = injector.subscribe(listener)
    const empty = injector.pending()
    injector.force('link_expired')
    expect(injector.pending()).not.toBe(empty)
    injector.take()
    injector.clear() // already empty: no change, no call
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    injector.force('link_revoked')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
