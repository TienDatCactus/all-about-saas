type Action =
  | {
      type: "reset";
      src: string;
    }
  | {
      type: "retry";
      src: string;
    }
  | {
      type: "fallback";
      src: string;
    }
  | {
      type: "loaded";
    };

type LoaderState = {
  activeSrc: string;
  usedFallback: boolean;
  visible: boolean;
};

export function imageReducer(state: LoaderState, action: Action): LoaderState {
  switch (action.type) {
    case "reset":
      return {
        activeSrc: action.src,
        usedFallback: false,
        visible: false,
      };

    case "retry":
      return {
        ...state,
        activeSrc: action.src,
      };

    case "loaded":
      return {
        ...state,
        visible: true,
      };

    case "fallback":
      return {
        ...state,
        usedFallback: true,
        activeSrc: action.src,
      };
  }
}
