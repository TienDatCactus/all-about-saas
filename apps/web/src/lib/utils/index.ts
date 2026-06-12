import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function loadEnv(name: string, defaultValue?: string): string {
  const value = import.meta.env[name]
  if (typeof value === "undefined") {
    if (typeof defaultValue === "undefined") {
      throw new Error(`Environment variable ${name} is not defined`)
    }
    return defaultValue
  }
  return value
}

export function loadAsset(path: string, segment: string): string {
  const baseUrl = loadEnv("ASSET_BASE_URL", "/")
  return `${baseUrl}${segment}/${path}`
}
