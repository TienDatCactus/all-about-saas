export const AUTH = {
  login: "/auth/login",
  signup: "/auth/signup",
  googleLogin: `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/auth/google`,
  logout: "/auth/logout",
  refresh: "/auth/refresh",
  verifyEmail: "/auth/verify-email",
  sendVerificationEmail: "/auth/send-verification-email",
};
