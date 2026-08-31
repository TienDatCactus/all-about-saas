type Action =
  | {
      type: "reset"
      src: string
    }
  | {
      /**
       * Fired synchronously the moment the retry ref is incremented — kept
       * separate from "retry" (which fires later, once the backoff delay
       * elapses) so this mirror never lags the ref: a render that happens
       * during the delay window must see the same count the ref already has.
       */
      type: "retrying"
      retryCount: number
    }
  | {
      type: "retry"
      src: string
    }
  | {
      type: "fallback"
      src: string
    }
  | {
      type: "loaded"
    }

type LoaderState = {
  activeSrc: string
  usedFallback: boolean
  visible: boolean
  /**
   * Mirrors the `retryCount` ref in ImageLoader — the ref stays the source of
   * truth for the effect's own scheduling logic, but React Compiler flags
   * reading `ref.current` during render, so this copy (dispatched at the same
   * moment the ref is mutated) is what the render body reads instead.
   */
  retryCount: number
}

export function imageReducer(state: LoaderState, action: Action): LoaderState {
  switch (action.type) {
    case "reset":
      return {
        activeSrc: action.src,
        usedFallback: false,
        visible: false,
        retryCount: 0,
      }

    case "retrying":
      return {
        ...state,
        retryCount: action.retryCount,
      }

    case "retry":
      return {
        ...state,
        activeSrc: action.src,
      }

    case "loaded":
      return {
        ...state,
        visible: true,
      }

    case "fallback":
      return {
        ...state,
        usedFallback: true,
        activeSrc: action.src,
      }
  }
}
