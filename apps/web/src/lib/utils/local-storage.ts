/**
 * localStorage does not exist during SSR, and this app server-renders. Without
 * this guard every helper below threw on the server and the catch blocks logged
 * a scary "Error removing window.localStorage key" on module load — an error
 * that read like a bug but only meant "there is no browser here".
 *
 * A no-op is the honest server behaviour: reads have nothing to return, writes
 * have nowhere to go, and the browser will run the same code again on hydration.
 * The try/catch stays for the failures that ARE real — quota exceeded, Safari
 * private mode, storage disabled by policy.
 */
const isBrowser = () => typeof window !== "undefined"

export const storage = {
  get: <T>(key: string): T | null => {
    if (!isBrowser()) return null
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      // If it is a string representation of a JSON object/array/value, parse it, otherwise return as string
      try {
        return JSON.parse(item) as T
      } catch {
        return item as unknown as T
      }
    } catch (error) {
      console.error(`Error reading window.localStorage key "${key}":`, error)
      return null
    }
  },

  set: <T>(key: string, value: T): void => {
    if (!isBrowser()) return
    try {
      const valueToStore =
        typeof value === "string" ? value : JSON.stringify(value)
      localStorage.setItem(key, valueToStore)
    } catch (error) {
      console.error(`Error setting window.localStorage key "${key}":`, error)
    }
  },

  remove: (key: string): void => {
    if (!isBrowser()) return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Error removing window.localStorage key "${key}":`, error)
    }
  },

  clear: (): void => {
    if (!isBrowser()) return
    try {
      localStorage.clear()
    } catch (error) {
      console.error("Error clearing window.localStorage:", error)
    }
  },
}
