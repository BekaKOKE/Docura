import type { ComponentType } from 'react'
import type { ScreenId } from '../app/screens'
import { LoginScreen } from './account/LoginScreen'
import { RegisterScreen } from './account/RegisterScreen'
import { SettingsScreen } from './company/SettingsScreen'
import { SetupScreen } from './company/SetupScreen'

// The screens whose M1 issue has landed. Every other screen still shows its Placeholder (ScreenRoute).
export const implementedScreens: Partial<Record<ScreenId, ComponentType>> = {
  S01: RegisterScreen,
  S02: LoginScreen,
  S03: SetupScreen,
  S28: SettingsScreen,
}
