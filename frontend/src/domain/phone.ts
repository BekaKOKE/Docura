// A Kazakhstan phone number: +7 and 10 digits (spec §4.1, #15 AC 3). The format is "+7 701 123 45 67".
// Spaces, dashes and brackets in what the user typed are ignored. An "8" or "7" in front of 10 digits is the
// same number written the old way, so it is accepted and stored as "+7".

const NATIONAL_DIGITS = 10

/** "+7 701 123 45 67" from what was typed, or null when it isn't a +7 number with 10 digits. */
export function normalizeKzPhone(input: string): string | null {
  const trimmed = input.trim()
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length !== NATIONAL_DIGITS + 1) return null
  // "8" in front of the number (no plus) is the old way of writing +7; "+8..." is some other country.
  if (!digits.startsWith('7') && !(digits.startsWith('8') && !trimmed.startsWith('+'))) return null
  const national = digits.slice(1)
  return `+7 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`
}

export function isValidKzPhone(input: string): boolean {
  return normalizeKzPhone(input) !== null
}
