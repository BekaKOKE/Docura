// Picks the renderer for a document type. The preview screen, the editor's pane and the public page all go
// through this one component, so a quote looks the same in each of them and on paper.

import type { DocumentType } from '../services'
import { InvoiceDoc } from './InvoiceDoc'
import type { DocProps } from './model'
import { QuoteDoc } from './QuoteDoc'

export interface DocumentRendererProps extends DocProps {
  type: DocumentType
}

export function DocumentRenderer({ type, ...props }: DocumentRendererProps) {
  if (type === 'quote') return <QuoteDoc {...props} />
  if (type === 'invoice') return <InvoiceDoc {...props} />
  return null
}
