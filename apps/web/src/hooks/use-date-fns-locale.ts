import { enUS, vi } from "date-fns/locale"
import type { Locale } from "date-fns"
import { useLanguage } from "@/lib/context/language"

const LOCALES: Record<string, Locale> = { vi, en: enUS }

/** date-fns `Locale` for the app's current language — pass as `{ locale }` to `format`. */
export function useDateFnsLocale(): Locale {
  const { language } = useLanguage()
  return LOCALES[language] ?? enUS
}

const TIME_FORMAT: Record<string, string> = { vi: "HH:mm", en: "h:mm a" }
const HOUR_FORMAT: Record<string, string> = { vi: "HH:00", en: "hh a" }

/** Vietnamese reads the 24h clock (19:00); English keeps 12h with am/pm.
 *  `time` is for a full HH:MM stamp, `hour` for an on-the-hour axis label. */
export function useTimeFormat(): { time: string; hour: string } {
  const { language } = useLanguage()
  return {
    time: TIME_FORMAT[language] ?? TIME_FORMAT.en!,
    hour: HOUR_FORMAT[language] ?? HOUR_FORMAT.en!,
  }
}
