import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import enCommon from "@/locales/en/common.json"
import viCommon from "@/locales/vi/common.json"

export const languages = ["en", "vi"] as const
export type Language = (typeof languages)[number]
export const defaultLanguage: Language = "vi"

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    resources: {
      en: { common: enCommon },
      vi: { common: viCommon },
    },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  })
}

export default i18n
