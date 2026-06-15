import { authApi } from "@/services/auth";
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { toast } from "sonner";
import { AppConstants } from "./constants";
import { storage } from "./local-storage";

export class HttpClient {
  private axiosInstance!: AxiosInstance;
  private static instance: HttpClient;

  private constructor() {
    this.setupAxios();
    this.setupInterceptors();
  }

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private setupAxios() {
    this.axiosInstance = axios.create({
      baseURL: AppConstants.apiBaseUrl,
      timeout: 10000,
    });
  }
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = storage.get<string>(AppConstants.tokenKey);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const method = response.config.method?.toUpperCase();
        const message =
          response.data?.message ||
          response.data.data?.message ||
          "Request successful";

        if (method && method !== "GET") {
          toast.success(message);
        }

        if (response.data && response.data.success !== undefined) {
          return response.data.data;
        }
        return response.data;
      },
      async (error) => {
        const status =
          error.response?.status || error.response?.data?.statusCode;
        const message =
          error.response?.data?.message || error.message || "An error occurred";
        const timestamp =
          error.response?.data?.timestamp || new Date().toISOString();

        const requestUrl = error.config?.url || "";
        const isAuthRequest =
          requestUrl.includes("/auth/refresh") ||
          requestUrl.includes("/auth/logout");

        if (status === 401 && !isAuthRequest) {
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshPromise = authApi.refresh();

            this.refreshPromise.catch(() => {
              storage.clear();
              window.location.href = "/login";
            });

            this.refreshPromise.finally(() => {
              this.isRefreshing = false;
              this.refreshPromise = null;
            });
          }

          try {
            const token = await this.refreshPromise;
            storage.set(AppConstants.tokenKey, token);

            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        if (status === 401 && isAuthRequest) {
          storage.clear();
          if (requestUrl.includes("/auth/refresh")) {
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }

        toast.error(message, {
          description: `Status: ${status} - ${timestamp}`,
        });
        return Promise.reject(error.response?.data || error);
      },
    );
  }

  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.axiosInstance.get(url, config) as unknown as Promise<T>;
  }

  public post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.axiosInstance.post(url, data, config) as unknown as Promise<T>;
  }

  public put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.axiosInstance.put(url, data, config) as unknown as Promise<T>;
  }

  public patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.axiosInstance.patch(url, data, config) as unknown as Promise<T>;
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.axiosInstance.delete(url, config) as unknown as Promise<T>;
  }
}

export const http = HttpClient.getInstance();
