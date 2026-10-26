import type { DocumentType } from '../services'

/** The document types that have a renderer today. The act (ActDoc) is built in #31. */
export const renderedTypes: readonly DocumentType[] = ['quote', 'invoice']

export function hasRenderer(type: DocumentType): boolean {
  return renderedTypes.includes(type)
}
