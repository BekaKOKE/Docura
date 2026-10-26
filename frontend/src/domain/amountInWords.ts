// "Сумма прописью" for the счёт and the АВР (spec §6; docs/kz-rules.md row 4).
// Tenge in Russian words with a capital first letter, "тенге" never changes, tiyn as two digits followed by
// тиын / тиына / тиынов. Zero tiyn is written "00 тиын" as on accounting documents (owner's decision, 20.10.2026).

import { assertTiyn, type Tiyn } from './money'

const TIYN_PER_TENGE = 100n

type Gender = 'masculine' | 'feminine'

const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
]
const UNITS_MASCULINE = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const UNITS_FEMININE = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']

// Index 0 is the tenge themselves (no scale word); thousands are feminine, the rest masculine.
const SCALES: { forms: [string, string, string]; gender: Gender }[] = [
  { forms: ['', '', ''], gender: 'masculine' },
  { forms: ['тысяча', 'тысячи', 'тысяч'], gender: 'feminine' },
  { forms: ['миллион', 'миллиона', 'миллионов'], gender: 'masculine' },
  { forms: ['миллиард', 'миллиарда', 'миллиардов'], gender: 'masculine' },
  { forms: ['триллион', 'триллиона', 'триллионов'], gender: 'masculine' },
]

// 1, 21 → first form; 2–4, 22–24 → second; 0, 5–20, 25–30 … → third.
function pluralIndex(n: number): 0 | 1 | 2 {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 2
  if (last === 1) return 0
  if (last >= 2 && last <= 4) return 1
  return 2
}

// 1–999 in words.
function triplet(n: number, gender: Gender): string[] {
  const words: string[] = []
  // Digits, not divisions: "042" → hundreds 0, tens 4, units 2.
  const [hundreds, tens, units] = String(n).padStart(3, '0').split('').map(Number)
  words.push(HUNDREDS[hundreds])
  if (tens === 1) {
    words.push(TEENS[units])
  } else {
    words.push(TENS[tens])
    words.push((gender === 'feminine' ? UNITS_FEMININE : UNITS_MASCULINE)[units])
  }
  return words.filter((word) => word !== '')
}

function tengeInWords(tenge: bigint): string {
  if (tenge === 0n) return 'ноль'
  const words: string[] = []
  let rest = tenge
  const groups: number[] = []
  while (rest > 0n) {
    groups.push(Number(rest % 1000n))
    rest /= 1000n
  }
  if (groups.length > SCALES.length) throw new RangeError('Amount is too large to write in words')

  for (let scale = groups.length - 1; scale >= 0; scale -= 1) {
    const group = groups[scale]
    if (group === 0) continue
    const { forms, gender } = SCALES[scale]
    words.push(...triplet(group, gender))
    if (scale > 0) words.push(forms[pluralIndex(group)])
  }
  return words.join(' ')
}

function tiynWord(tiyn: number): string {
  return ['тиын', 'тиына', 'тиынов'][tiyn === 0 ? 0 : pluralIndex(tiyn)]
}

// 32393000 → "Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын"
export function amountInWords(amountTiyn: Tiyn): string {
  assertTiyn(amountTiyn)
  if (amountTiyn < 0) throw new RangeError('Amount in words expects a non-negative amount')

  const total = BigInt(amountTiyn)
  const tenge = tengeInWords(total / TIYN_PER_TENGE)
  const tiyn = Number(total % TIYN_PER_TENGE)
  const sentence = `${tenge} тенге ${String(tiyn).padStart(2, '0')} ${tiynWord(tiyn)}`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}
