// The document renderers (#21). Import from here:
//   import { QuoteDoc, InvoiceDoc, EditorWithPreview, printDocument } from '../documents'
// The act renderer (ActDoc) comes with #31.
//
//   QuoteDoc, InvoiceDoc      the A4 sheets; take a RenderableDocument (a Document, a PublicDocument or an editor draft)
//   DocumentRenderer          picks one by the document type
//   DocumentViewport          shows a sheet scaled to its box (fit) or at real size with its own scroll (actual)
//   PreviewPane               the sticky 520 px live preview; EditorWithPreview is the form + preview layout for #19
//   printDocument             "Скачать PDF": the print dialog with the A4 print CSS
export { DocumentRenderer, type DocumentRendererProps } from './DocumentRenderer'
export { DocumentViewport } from './DocumentViewport'
export { InvoiceDoc } from './InvoiceDoc'
export type { DocProps, RenderableDocument, RenderableLine } from './model'
export { EditorWithPreview, PreviewPane } from './PreviewPane'
export { printDocument } from './print'
export { QuoteDoc } from './QuoteDoc'
export { hasRenderer, renderedTypes } from './renderers'
export { fitScale, type Zoom } from './scale'
