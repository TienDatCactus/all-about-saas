import { createContext, useContext, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ME_QUERY_KEY, useMeQuery, usersApi, type Me } from "@/services/users"
import { authApi, useLogoutMutation } from "@/services/auth"
import { setAccessToken } from "@/lib/utils/access-token"

export interface AuthContextType {
  /** The signed-in user, or null while loading / when signed out. */
  user: Me | null
  /** True while the initial /users/me fetch is still in flight. */
  isPending: boolean
  /** Function to sign the user out. */
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading } = useMeQuery()
  const { mutate: logout } = useLogoutMutation()
  const queryClient = useQueryClient()
  const ssoHandled = useRef(false)

  /**
   * SSO landing. The OAuth callback redirects here with `?sso=1` after
   * minting a refresh cookie — but that cookie is httpOnly and the access
   * token lives only in JS memory, so as far as this SPA can tell the visitor
   * is anonymous. The marker is the signal to exchange the cookie for an
   * access token right now (instead of waiting for some future 401) and load
   * /users/me, which flips the auth gate to the protected page underneath.
   */
  useEffect(() => {
    // Guarded by a ref, not [] alone: StrictMode double-invokes effects, and
    // two concurrent refreshes would race the rotation grace window.
    if (ssoHandled.current) return
    ssoHandled.current = true

    const params = new URLSearchParams(window.location.search)
    if (!params.has("sso")) return

    // Strip the marker first so a reload (or a copied URL) doesn't replay it.
    params.delete("sso")
    const query = params.toString()
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        (query ? `?${query}` : "") +
        window.location.hash
    )

    authApi
      .refresh()
      .then((token) => {
        setAccessToken(token)
        return queryClient.fetchQuery({
          queryKey: ME_QUERY_KEY,
          queryFn: () => usersApi.me(),
          staleTime: 0,
        })
      })
      // A hand-typed ?sso=1 with no cookie: the refresh 401 path already
      // clears state; the visitor simply stays anonymous.
      .catch(() => {})
  }, [queryClient])

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isPending: isLoading,
        logout: () => logout(),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
