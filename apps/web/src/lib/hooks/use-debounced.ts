import * as React from "react"

/**
 * The value, held back until it has stopped changing for `delayMs`.
 *
 * For search-as-you-type this is the difference between one request per
 * keystroke and one request per pause. Typing "Nguyen" used to key six distinct
 * queries ("Ng" … "Nguyen"), each a real round trip against a per-IP rate limit;
 * debounced, the intermediate prefixes never become requests at all.
 *
 * Deliberately not React's `useDeferredValue`: that yields to render priority,
 * which says nothing about how long it has been since the user typed. Here the
 * elapsed time IS the signal.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    // Every change restarts the clock, so only a pause lets a value through.
    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
