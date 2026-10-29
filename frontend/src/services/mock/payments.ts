// The mock PaymentsService. Only the reading side is built here (#28: the invoice's card lists its payments); recording
// and removing a payment, with the overpayment check and the undo, come with #30.

import type { PaymentsService } from '../contracts'
import { NotImplementedError } from '../notImplemented'
import type { Payment } from '../types'
import type { MockRuntime } from './runtime'

function notBuilt(method: string): NotImplementedError {
  return new NotImplementedError('mock', `payments.${method}`, 'built in #30')
}

export function createMockPayments(getRuntime: () => MockRuntime): PaymentsService {
  return {
    list(documentId) {
      const runtime = getRuntime()
      return runtime.call(() =>
        runtime.store.read((db): Payment[] => {
          // The invoice is looked up first: another company's id is a 404 like any other (company scope in the data layer).
          const document = db.get('documents', documentId)
          return db
            .rows('payments')
            .filter((payment) => payment.documentId === document.id)
            .map((payment, order) => ({ payment, order }))
            .sort((a, b) => (a.payment.paidOn === b.payment.paidOn ? a.order - b.order : a.payment.paidOn < b.payment.paidOn ? -1 : 1))
            .map(({ payment }) => payment)
        }),
      )
    },

    create: async () => {
      throw notBuilt('create')
    },

    remove: async () => {
      throw notBuilt('remove')
    },
  }
}
