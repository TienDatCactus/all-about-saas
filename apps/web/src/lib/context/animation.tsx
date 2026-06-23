import { useReducedMotionConfig } from "motion/react";
import React, { createContext, useContext } from "react";
type MotionPreference = "on" | "off" | "system";
interface MotionContextValue {
  preference: MotionPreference;

  reducedMotion: boolean;

  setPreference: (value: MotionPreference) => void;
}

const MotionContext = React.createContext<MotionContextValue | undefined>(
  undefined,
);
export function MotionProvider({ children }: React.PropsWithChildren) {
  const systemReducedMotion = useReducedMotionConfig();

  const [preference, setPreference] =
    React.useState<MotionPreference>("system");

  const reducedMotion =
    preference === "system" ? !!systemReducedMotion : preference === "off";

  return (
    <MotionContext.Provider
      value={{
        preference,
        reducedMotion,
        setPreference,
      }}
    >
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion() {
  const context = React.useContext(MotionContext);

  if (!context) {
    throw new Error("useMotion must be used within MotionProvider");
  }

  return context;
}
