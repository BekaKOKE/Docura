import { LOGO_HEAD_BYTES, logoProblem } from '../../domain/logo'
import type { MessageKey } from '../../i18n/t'

/** The message key for a file that can't be the logo (checked before it is sent; the service checks again), or null when it can. */
export async function logoFileProblem(file: Blob): Promise<MessageKey | null> {
  const head = new Uint8Array(await file.slice(0, LOGO_HEAD_BYTES).arrayBuffer())
  const problem = logoProblem(file.size, head)
  if (problem === 'type') return 'logo.error.type'
  return problem === 'size' ? 'logo.error.size' : null
}
