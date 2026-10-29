import type { ComponentType } from 'react'
import type { ScreenId } from '../app/screens'
import { LoginScreen } from './account/LoginScreen'
import { RegisterScreen } from './account/RegisterScreen'
import { SettingsScreen } from './company/SettingsScreen'
import { SetupScreen } from './company/SetupScreen'
import { DocumentPreview } from './DocumentPreview'
import { ConvertScreen } from './convert/ConvertScreen'
import { InvoiceDetailScreen } from './invoices/InvoiceDetailScreen'
import { InvoicesListScreen } from './invoices/InvoicesListScreen'
import { PublicScreen } from './public/PublicScreen'
import { QuoteEditorScreen } from './quoteEditor/QuoteEditorScreen'
import { QuoteDetailScreen } from './quotes/QuoteDetailScreen'
import { QuotesListScreen } from './quotes/QuotesListScreen'
import { SendScreen } from './quotes/SendScreen'

// The screens whose M1 issue has landed. Every other screen still shows its Placeholder (ScreenRoute).
export const implementedScreens: Partial<Record<ScreenId, ComponentType>> = {
  S01: RegisterScreen,
  S02: LoginScreen,
  S03: SetupScreen,
  S06: QuotesListScreen,
  S07: QuoteEditorScreen,
  S08: DocumentPreview,
  S09: SendScreen,
  S11: PublicScreen,
  S13: QuoteDetailScreen,
  S14: ConvertScreen,
  S15: InvoicesListScreen,
  S16: InvoiceDetailScreen,
  S21: InvoicesListScreen,
  S28: SettingsScreen,
}
