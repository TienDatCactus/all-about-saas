const URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
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
  changePassword: "/auth/change-password",
  resetPassword: "/auth/reset-password",
};

export const BADMINTON = {
  sessions: "/badminton/sessions",
  session: (id: string) => `/badminton/sessions/${id}`,
  suggest: "/badminton/participants/suggest",
  publicSession: (shareToken: string) => `/badminton/public/${shareToken}`,
};
