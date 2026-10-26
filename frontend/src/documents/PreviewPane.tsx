// The live preview next to the editor. On a desktop (1024 px and wider) the form and a sticky 520 px pane with the
// A4 sheet sit side by side; below that the pane is not shown and the editor opens the preview screen (S08).
//
// For the editor (#19):
//   <EditorWithPreview preview={{ type: 'quote', document: draft }}>{form}</EditorWithPreview>
// where `draft` is a RenderableDocument built from the form state on every change. A draft needs no totals: the
// renderer computes them from quantity, price and the VAT switch with src/domain, as the editor does.

import type { ReactNode } from 'react'
import { t } from '../i18n/t'
import { DocumentRenderer, type DocumentRendererProps } from './DocumentRenderer'
import { DocumentViewport } from './DocumentViewport'
import './preview.css'

export function PreviewPane(props: DocumentRendererProps) {
  return (
    <aside className="doc-pane" aria-label={t('preview.pane')}>
      <DocumentViewport zoom="fit">
        <DocumentRenderer {...props} />
      </DocumentViewport>
    </aside>
  )
}

export function EditorWithPreview({ preview, children }: { preview: DocumentRendererProps; children: ReactNode }) {
  return (
    <div className="doc-split">
      <div className="doc-split-form">{children}</div>
      <div className="doc-split-pane">
        <PreviewPane {...preview} />
      </div>
    </div>
  )
}
