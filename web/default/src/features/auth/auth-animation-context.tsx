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
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type AuthAnimationContextValue = {
  isTyping: boolean
  showPassword: boolean
  passwordLength: number
  setIsTyping: (value: boolean) => void
  setShowPassword: (value: boolean) => void
  setPasswordLength: (value: number) => void
}

const AuthAnimationContext = createContext<AuthAnimationContextValue | null>(
  null
)

export function AuthAnimationProvider({ children }: { children: ReactNode }) {
  const [isTyping, setIsTyping] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLength, setPasswordLength] = useState(0)

  const value = useMemo(
    () => ({
      isTyping,
      showPassword,
      passwordLength,
      setIsTyping,
      setShowPassword,
      setPasswordLength,
    }),
    [isTyping, showPassword, passwordLength]
  )

  return (
    <AuthAnimationContext.Provider value={value}>
      {children}
    </AuthAnimationContext.Provider>
  )
}

export function useAuthAnimation() {
  const context = useContext(AuthAnimationContext)
  if (!context) {
    throw new Error('useAuthAnimation must be used within AuthAnimationProvider')
  }
  return context
}

export function useAuthAnimationOptional() {
  return useContext(AuthAnimationContext)
}
