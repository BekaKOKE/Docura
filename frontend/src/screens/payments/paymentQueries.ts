import { useCallback, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'

// What every screen does after a payment was recorded or removed, and the state of the toast that follows it (#30).

/**
 * After a payment changed: the invoice's card, every list of documents, the payments of that invoice and the dashboard's
 * figures are stale. They are marked, not rewritten, so the badge, the bar and the balance come from the service.
 */
export function refreshAfterPaymentChange(client: QueryClient, invoiceId: string): void {
  void client.invalidateQueries({ queryKey: ['documents', 'detail', invoiceId] })
  void client.invalidateQueries({ queryKey: ['documents', 'list'] })
  void client.invalidateQueries({ queryKey: ['payments', invoiceId] })
  void client.invalidateQueries({ queryKey: ['dashboard'] })
}

/** What the toast says: a payment just recorded (with "Отменить"), or a plain notice. `id` restarts the timer for a new one. */
export type PaymentToastState =
  | { id: number; kind: 'recorded'; paymentId: string; invoiceId: string }
  | { id: number; kind: 'notice'; text: string }

type NewToast = { kind: 'recorded'; paymentId: string; invoiceId: string } | { kind: 'notice'; text: string }

let nextToastId = 0

/** The toast of a screen: the current one (or null), a way to show a new one, and a stable way to dismiss it. */
export function usePaymentToast() {
  const [toast, setToast] = useState<PaymentToastState | null>(null)
  const show = useCallback((next: NewToast) => setToast({ ...next, id: ++nextToastId }), [])
  const dismiss = useCallback(() => setToast(null), [])
  return { toast, show, dismiss }
}
