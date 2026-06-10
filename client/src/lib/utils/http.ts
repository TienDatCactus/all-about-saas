import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { AppConstants } from "./constants";
import { storage } from "./local-storage";
import { toast } from "sonner";
import { authApi } from "@/services/auth";

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
        // Automatically unwrap NestJS standard response format { success, data, message }
        if (response.data && response.data.success !== undefined) {
          return response.data.data;
        }
        return response.data;
      },
      async (error) => {
        let isRefreshing = false;
        let refreshPromise: Promise<string> | null = null;

        const status =
          error.response?.status || error.response?.data?.statusCode;
        const message =
          error.response?.data?.message || error.message || "An error occurred";
        const timestamp =
          error.response?.data?.timestamp || new Date().toISOString();
        if (status === 401) {
          if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = authApi.refresh();
            refreshPromise.catch(() => {
              storage.remove(AppConstants.tokenKey);
              authApi.logout();
            });
            refreshPromise.finally(() => {
              isRefreshing = false;
            });
          }
          const token = await refreshPromise;
          storage.set(AppConstants.tokenKey, token);
          const originalRequest = error.config;
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return this.axiosInstance(originalRequest);
        }
        toast.error(message, {
          description: `Status: ${status} - ${timestamp}`,
        });
        // Reject with the error payload returned by our HttpExceptionFilter
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
