import type { ComponentType } from 'react'
import type { ScreenId } from '../app/screens'
import { LoginScreen } from './account/LoginScreen'
import { RegisterScreen } from './account/RegisterScreen'
import { SettingsScreen } from './company/SettingsScreen'
import { SetupScreen } from './company/SetupScreen'
import { DocumentPreview } from './DocumentPreview'
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
  S13: QuoteDetailScreen,
  S28: SettingsScreen,
}
