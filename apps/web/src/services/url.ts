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
  participantPayment: (sessionId: string, participantId: string) =>
    `/badminton/sessions/${sessionId}/participants/${participantId}/payment`,
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

export const TEACHER_ROOM = {
  studentSuggest: "/teacher-room/students/suggest",
  slots: "/teacher-room/slots",
  slot: (id: string) => `/teacher-room/slots/${id}`,
  sessions: "/teacher-room/sessions",
  sessionsPendingToday: "/teacher-room/sessions/pending-today",
  sessionHistory: (id: string) => `/teacher-room/sessions/${id}/history`,
  sessionReschedule: (id: string) => `/teacher-room/sessions/${id}/reschedule`,
  sessionCancel: (id: string) => `/teacher-room/sessions/${id}/cancel`,
  sessionComplete: (id: string) => `/teacher-room/sessions/${id}/complete`,
  sessionReopen: (id: string) => `/teacher-room/sessions/${id}/reopen`,
  sessionPriority: (id: string) => `/teacher-room/sessions/${id}/priority`,
}
