export const AppConstants = {
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000",
  tokenKey: "access_token",
  refreshTokenKey: "refresh_token",
}
