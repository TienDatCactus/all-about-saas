import axios from "axios"
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./access-token"
import { AppConstants } from "./constants"
import { storage } from "./local-storage"
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"
import { toast } from "@/components/custom/toast"
import { authApi } from "@/services/auth"

/**
 * HTTP status out of whatever the response interceptor rejected with, which is
 * three different shapes depending on where the failure happened:
 *
 *   - the API's error envelope (`{ statusCode, code, message, … }`) — the
 *     common case, because the interceptor rejects with `error.response.data`
 *   - a raw axios error, when there is no response body at all (network down,
 *     CORS, timeout)
 *   - a plain Error (e.g. ResponseContractError) — no status, and no amount of
 *     retrying will produce one
 *
 * Returns undefined when the failure has no HTTP status, which callers should
 * read as "not a server verdict".
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const e = error as {
    statusCode?: unknown
    status?: unknown
    response?: { status?: unknown }
  }
  const candidate = e.statusCode ?? e.response?.status ?? e.status
  return typeof candidate === "number" ? candidate : undefined
}

export class HttpClient {
  private axiosInstance!: AxiosInstance
  // Undefined until getInstance() first runs — the lazy latch below reads it
  // before it is assigned, so the type has to admit that.
  private static instance: HttpClient | undefined

  private constructor() {
    this.setupAxios()
    this.setupInterceptors()
  }

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient()
    }
    return HttpClient.instance
  }

  private setupAxios() {
    this.axiosInstance = axios.create({
      baseURL: AppConstants.apiBaseUrl,
      timeout: 10000,
      withCredentials: true,
    })
  }
  private refreshPromise: Promise<string> | null = null

  private setupInterceptors(): void {
    // Request interceptor. The token comes from module memory, never storage
    // (see access-token.ts for why). After a reload memory is empty, so the
    // first protected call goes out without a header, 401s, and the handler
    // below rehydrates it from the refresh cookie — no boot-time ceremony.
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const method = response.config.method?.toUpperCase()
        const message =
          response.data?.message ||
          response.data.data?.message ||
          "Request successful"

        if (method && method !== "GET") {
          toast.success(message)
        }

        if (response.data && response.data.success !== undefined) {
          return response.data.data
        }
        return response.data
      },
      async (error) => {
        const status =
          error.response?.status || error.response?.data?.statusCode
        const requestUrl = error.config?.url || ""
        const isAuthRequest =
          requestUrl.includes("/auth/refresh") ||
          requestUrl.includes("/auth/logout")

        const originalRequest = error.config as
          | (InternalAxiosRequestConfig & { _retry?: boolean })
          | undefined
        if (
          status === 401 &&
          !isAuthRequest &&
          originalRequest &&
          !originalRequest._retry
        ) {
          // Share a single in-flight refresh across all concurrent 401s.
          if (!this.refreshPromise) {
            this.refreshPromise = authApi.refresh().finally(() => {
              this.refreshPromise = null
            })
          }

          try {
            const token = await this.refreshPromise
            setAccessToken(token)

            originalRequest._retry = true
            originalRequest.headers.Authorization = `Bearer ${token}`
            return this.axiosInstance(originalRequest)
          } catch (refreshError) {
            clearAccessToken()
            storage.clear()
            window.location.href = "/auth/login"
            return Promise.reject(
              refreshError instanceof Error
                ? refreshError
                : new Error(String(refreshError))
            )
          }
        }

        if (status === 401 && isAuthRequest) {
          clearAccessToken()
          storage.clear()
          if (requestUrl.includes("/auth/refresh")) {
            window.location.href = "/auth/login"
          }
          return Promise.reject(error)
        }

        toast.api(error)
        return Promise.reject(error.response?.data || error)
      }
    )
  }

  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.axiosInstance.get(url, config) as unknown as Promise<T>
  }

  public post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.axiosInstance.post(url, data, config) as unknown as Promise<T>
  }

  public put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.axiosInstance.put(url, data, config) as unknown as Promise<T>
  }

  public patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.axiosInstance.patch(url, data, config) as unknown as Promise<T>
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.axiosInstance.delete(url, config) as unknown as Promise<T>
  }
}

export const http = HttpClient.getInstance()
