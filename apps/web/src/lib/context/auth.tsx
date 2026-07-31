import { createContext, useContext, useEffect, useState } from "react"

export interface AuthContextType {
  user: any
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
  // STUB: nothing ever sets this, so `user` is permanently null and no consumer
  // can tell who is signed in. The API now exposes GET /users/me — wiring it
  // here (via a query hook) is what makes this provider real.
  const [user] = useState<any>(null)

  useEffect(() => {
    if (!user) {
      //fetch me
    }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
