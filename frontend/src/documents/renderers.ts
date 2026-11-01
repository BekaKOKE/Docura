import type { DocumentType } from '../services'

/** The document types that have a renderer today: the quote, the invoice and the act (ActDoc). */
export const renderedTypes: readonly DocumentType[] = ['quote', 'invoice', 'act']

export function hasRenderer(type: DocumentType): boolean {
  return renderedTypes.includes(type)
}
