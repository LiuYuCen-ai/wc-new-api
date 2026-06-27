/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthAnimationState = {
  isTyping: boolean
  showPassword: boolean
  passwordLength: number
}

const defaultAuthAnimationState: AuthAnimationState = {
  isTyping: false,
  showPassword: false,
  passwordLength: 0,
}

type AuthAnimationContextValue = {
  state: AuthAnimationState
  setAuthAnimationState: (patch: Partial<AuthAnimationState>) => void
}

const AuthAnimationContext = createContext<AuthAnimationContextValue | null>(
  null
)

type AuthAnimationProviderProps = {
  children: ReactNode
}

export function AuthAnimationProvider(props: AuthAnimationProviderProps) {
  const [state, setState] = useState<AuthAnimationState>(
    defaultAuthAnimationState
  )

  const setAuthAnimationState = useCallback(
    (patch: Partial<AuthAnimationState>) => {
      setState((previous) => ({ ...previous, ...patch }))
    },
    []
  )

  const value = useMemo(
    () => ({ state, setAuthAnimationState }),
    [state, setAuthAnimationState]
  )

  return (
    <AuthAnimationContext.Provider value={value}>
      {props.children}
    </AuthAnimationContext.Provider>
  )
}

export function useAuthAnimation() {
  return useContext(AuthAnimationContext)
}

export { defaultAuthAnimationState }
