import { enUS, vi } from "date-fns/locale"
import type { Locale } from "date-fns"
import { useLanguage } from "@/lib/context/language"

const LOCALES: Record<string, Locale> = { vi, en: enUS }

/** date-fns `Locale` for the app's current language — pass as `{ locale }` to `format`. */
export function useDateFnsLocale(): Locale {
  const { language } = useLanguage()
  return LOCALES[language] ?? enUS
}
