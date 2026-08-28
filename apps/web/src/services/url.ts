const URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
export const AUTH = {
  login: "/auth/login",
  signup: "/auth/signup",
  googleLogin: `${URL}/auth/google`,
  githubLogin: `${URL}/auth/github`,
  facebookLogin: `${URL}/auth/facebook`,
  logout: "/auth/logout",
  refresh: "/auth/refresh",
  verifyEmail: "/auth/verify-email",
  sendVerificationEmail: "/auth/send-verification-email",
  // `resetPassword` finishes a forgotten-password flow with the emailed token;
  // `changePassword` is the signed-in user changing their own. The old
  // /auth/change-password and /auth/reset-password paths meant the opposite.
  resetPassword: "/auth/password/reset",
  changePassword: "/auth/password/change",
}

export const BADMINTON = {
  sessions: "/badminton/sessions",
  session: (id: string) => `/badminton/sessions/${id}`,
  suggest: "/badminton/participants/suggest",
  publicSession: (shareToken: string) => `/badminton/public/${shareToken}`,
}

export const PAYMENT_METHODS = {
  list: "/payment-methods",
  byId: (id: string) => `/payment-methods/${id}`,
}

export const USERS = {
  me: "/users/me",
}
