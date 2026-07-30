import React from "react"
import { toast as sonnerToast } from "sonner"
import Toast, { type ToastOptions } from "./ui"
import { normalizeApiError } from "./normalize"

const generateId = () => Math.random().toString(36).substring(2, 9)

function toast(
  optionsOrMessage: ToastOptions | React.ReactNode,
  options?: Omit<ToastOptions, "title">
) {
  let mergedOptions: ToastOptions
  if (
    React.isValidElement(optionsOrMessage) ||
    typeof optionsOrMessage === "string" ||
    typeof optionsOrMessage === "number"
  ) {
    mergedOptions = {
      status: "info",
      title: optionsOrMessage,
      ...options,
    }
  } else {
    mergedOptions = optionsOrMessage as ToastOptions
  }

  const id = mergedOptions.id || generateId()

  // Sonner fires onDismiss for programmatic dismissal and onAutoClose for its
  // own timer; guard so consumers see exactly one callback either way.
  let dismissFired = false
  const handleDismiss = () => {
    if (dismissFired) return
    dismissFired = true
    mergedOptions.onDismiss?.()
  }

  sonnerToast.custom(
    (sonnerId) => (
      <Toast
        id={sonnerId}
        options={{
          ...mergedOptions,
          id: String(sonnerId),
        }}
      />
    ),
    {
      // The Toast component owns the countdown (including pause), so sonner's
      // own timer stays off — otherwise it would remove a paused toast anyway.
      id,
      duration: Infinity,
      onDismiss: handleDismiss,
      onAutoClose: handleDismiss,
    }
  )

  return id
}

toast.success = (
  title: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title">
) => {
  return toast({
    status: "success",
    title,
    ...options,
  })
}

toast.error = (
  title: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title">
) => {
  return toast({
    status: "error",
    title,
    ...options,
  })
}

toast.warning = (
  title: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title">
) => {
  return toast({
    status: "warning",
    title,
    ...options,
  })
}

toast.info = (
  title: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title">
) => {
  return toast({
    status: "info",
    title,
    ...options,
  })
}

toast.loading = (
  title: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title">
) => {
  return toast({
    status: "loading",
    title,
    dismissible: false,
    ...options,
  })
}

toast.api = (
  error: unknown,
  title?: React.ReactNode,
  options?: Omit<ToastOptions, "status" | "title" | "error">
) => {
  const normalized = normalizeApiError(error)
  return toast({
    status: "error",
    title: title || normalized.title,
    description: normalized.message,
    error: normalized,
    ...options,
  })
}

toast.promise = <T,>(
  promise: Promise<T>,
  options: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: unknown) => string)
  }
) => {
  const id = toast.loading(options.loading)
  promise
    .then((data) => {
      const msg =
        typeof options.success === "function"
          ? options.success(data)
          : options.success
      toast({ id, status: "success", title: msg, duration: 4000 })
    })
    .catch((err) => {
      const msg =
        typeof options.error === "function" ? options.error(err) : options.error
      toast.api(err, msg, { id })
    })
  return promise
}

toast.dismiss = (id?: string | number) => {
  sonnerToast.dismiss(id)
}

export { toast }
