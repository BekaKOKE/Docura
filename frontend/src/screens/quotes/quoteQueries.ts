import { useQuery, type QueryClient } from '@tanstack/react-query'
import { services, type Document } from '../../services'

// The queries of the quotes screens. The keys are the ones the preview (S08) and the editor (S07) already use, so a
// quote saved in the editor is the quote the card shows.

export const quoteKey = (id: string) => ['documents', 'detail', id] as const
export const quotesListKey = (limit: number) => ['documents', 'list', { type: 'quote', limit }] as const

export function useQuote(id: string) {
  return useQuery({ queryKey: quoteKey(id), queryFn: () => services.documents.get(id) })
}

/** After a quote changed: its own copy is the new one, and every list is stale. */
export function rememberQuote(client: QueryClient, quote: Document): void {
  client.setQueryData(quoteKey(quote.id), quote)
  void client.invalidateQueries({ queryKey: ['documents', 'list'] })
}

/**
 * The signature image of a signed quote as a `data:` URL. A data URL needs no release, unlike an object URL, and
 * the PNG is small (at most 200 KB, spec §7).
 */
export function signatureImage(id: string): Promise<string> {
  return services.documents.signatureBlob(id).then(
    (blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      }),
  )
}
