import { authApi } from "@/services/auth"
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import { toast } from "@/components/custom/toast"
import { AppConstants } from "./constants"
import { storage } from "./local-storage"

export class HttpClient {
  private axiosInstance!: AxiosInstance
  private static instance: HttpClient

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
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = storage.get<string>(AppConstants.tokenKey)
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
            storage.set(AppConstants.tokenKey, token)

            originalRequest._retry = true
            originalRequest.headers.Authorization = `Bearer ${token}`
            return this.axiosInstance(originalRequest)
          } catch (refreshError) {
            storage.clear()
            window.location.href = "/auth/login"
            return Promise.reject(refreshError)
          }
        }

        if (status === 401 && isAuthRequest) {
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
