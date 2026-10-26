// The company logo: PNG or JPEG, at most 300 KB (replica/architecture.md, "File sizes"; #15 AC 5).
// The type is read from the first bytes, not from the file name or the type the browser guessed from it:
// a text file renamed `logo.png` is refused.

export const LOGO_MAX_BYTES = 300 * 1024
export type LogoType = 'image/png' | 'image/jpeg'
export type LogoProblem = 'type' | 'size'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]

/** How many bytes `detectLogoType` needs to see. */
export const LOGO_HEAD_BYTES = PNG.length

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte)

/** The image type the first bytes say it is, or null for anything else (a GIF, a text file, ...). */
export function detectLogoType(head: Uint8Array): LogoType | null {
  if (startsWith(head, PNG)) return 'image/png'
  if (startsWith(head, JPEG)) return 'image/jpeg'
  return null
}

/** What is wrong with a logo of this size whose first bytes are `head`, or null when it can be stored. The type is checked first: a big GIF is "wrong type". */
export function logoProblem(sizeBytes: number, head: Uint8Array): LogoProblem | null {
  if (detectLogoType(head) === null) return 'type'
  if (sizeBytes > LOGO_MAX_BYTES) return 'size'
  return null
}
