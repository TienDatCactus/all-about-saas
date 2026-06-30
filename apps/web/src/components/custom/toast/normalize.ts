export interface ToastError {
  status?: number;
  code?: string;
  title: string;
  message: string;
  details?: string;
  traceId?: string;
  path?: string;
  validation?: Record<string, string[]>;
}

export function normalizeApiError(error: unknown): ToastError {
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred.",
    };
  }

  const err = error as any;

  // Check if it is an Axios error / HTTP error response
  if (err.isAxiosError || err.response) {
    const status = err.response?.status;
    const data = err.response?.data;

    let title = "Request Failed";
    if (status === 400) {
      title = data?.code === "VALIDATION_FAILED" ? "Validation Failed" : "Bad Request";
    } else if (status === 401) {
      title = "Session Expired";
    } else if (status === 403) {
      title = "Access Denied";
    } else if (status === 404) {
      title = "Not Found";
    } else if (status >= 500) {
      title = "Internal Server Error";
    } else if (err.code === "ERR_NETWORK") {
      title = "No Internet Connection";
    }

    return {
      status,
      code: data?.code || err.code || "API_ERROR",
      title,
      message: data?.message || err.message || "Something went wrong.",
      details: typeof data?.error === "string" ? data.error : data?.error?.message || undefined,
      traceId: data?.traceId,
      path: data?.path || err.config?.url,
      validation: data?.validation || undefined,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Application Error",
      message: error.message,
      details: error.stack,
    };
  }

  return {
    title: "Error",
    message: String(error as string),
  };
}
