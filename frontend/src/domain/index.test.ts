import { describe, expect, it } from 'vitest'
import * as domain from './index'

describe('domain public API', () => {
  it('exports the functions the screens and services use', () => {
    for (const name of [
      'amountInWords',
      'computeLine',
      'computePrepayment',
      'computeTotals',
      'formatMoney',
      'isValidIik',
      'isValidIinBin',
      'parsePriceTiyn',
      'parseQuantityMilli',
      'searchKey',
      'splitGross',
      'validateIik',
      'validateIinBin',
      'validateKbe',
      'validateKnp',
    ] as const) {
      expect(typeof domain[name]).toBe('function')
    }
  })
})
