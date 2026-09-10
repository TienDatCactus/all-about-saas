import { useNavigate } from "@tanstack/react-router"

/** Generic (route-untyped) search-param patcher — works from any component
 *  regardless of which route it's nested under, since it only patches
 *  whatever search object TanStack Router hands the updater function. */
export function useSearchParamsSetter() {
  const navigate = useNavigate()

  function setSearchParams(params: Record<string, string | null>) {
    // `navigate` here is route-untyped (no `from`), so its `search` reducer
    // type is pinned to a route this hook deliberately doesn't know — the
    // cast is the price of staying usable from any component.
    void navigate({
      search: ((prev: Record<string, unknown>) => {
        const next = { ...prev }
        for (const [key, value] of Object.entries(params)) {
          if (value === null) delete next[key]
          else next[key] = value
        }
        return next
      }) as never,
    })
  }

  return setSearchParams
}
