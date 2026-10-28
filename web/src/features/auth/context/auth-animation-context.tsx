import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthAnimationFocusedField = 'username' | 'password' | null

export type AuthAnimationState = {
  focusedField: AuthAnimationFocusedField
  /** Password input plaintext is visible (eye toggle). */
  showPassword: boolean
  passwordLength: number
}

const defaultAuthAnimationState: AuthAnimationState = {
  focusedField: null,
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
