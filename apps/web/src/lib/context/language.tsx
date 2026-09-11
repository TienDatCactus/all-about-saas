import { createContext, useContext, useEffect, useState } from "react"
import { ScriptOnce } from "@tanstack/react-router"
import i18n, { defaultLanguage, languages, type Language } from "@/lib/i18n"
import { storage } from "@/lib/utils/local-storage"

type LanguageProviderProps = {
  children: React.ReactNode
  storageKey?: string
}

type LanguageProviderState = {
  language: Language
  setLanguage: (language: Language) => void
}

function isLanguage(value: unknown): value is Language {
  return languages.includes(value as Language)
}

function getLanguageScript(storageKey: string, fallback: Language) {
  const key = JSON.stringify(storageKey)
  const list = JSON.stringify(languages)
  const def = JSON.stringify(fallback)
  return `(function(){try{var l=localStorage.getItem(${key});if(${list}.indexOf(l)===-1){l=${def}}document.documentElement.lang=l}catch(e){}})();`
}

const LanguageProviderContext = createContext<
  LanguageProviderState | undefined
>(undefined)

export function LanguageProvider({
  children,
  storageKey = "language",
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)

  useEffect(() => {
    const stored = storage.get<string>(storageKey)
    const initial = isLanguage(stored) ? stored : defaultLanguage
    setLanguageState(initial)
    void i18n.changeLanguage(initial)
    document.documentElement.lang = initial
  }, [storageKey])

  const setLanguage = (next: Language) => {
    storage.set(storageKey, next)
    setLanguageState(next)
    void i18n.changeLanguage(next)
    document.documentElement.lang = next
  }

  return (
    <LanguageProviderContext value={{ language, setLanguage }}>
      <ScriptOnce>{getLanguageScript(storageKey, defaultLanguage)}</ScriptOnce>
      {children}
    </LanguageProviderContext>
  )
}

export function useLanguage() {
  const context = useContext(LanguageProviderContext)
  if (context === undefined)
    throw new Error("useLanguage must be used within a LanguageProvider")
  return context
}
