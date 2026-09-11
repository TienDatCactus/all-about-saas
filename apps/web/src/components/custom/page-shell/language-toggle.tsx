import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/context/language"
import { languages, type Language } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { TranslateIcon } from "@phosphor-icons/react"

const LANGUAGE_LABEL: Record<Language, string> = {
  vi: "VI",
  en: "EN",
}

export function LanguageToggler({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <Tabs
      value={language}
      className={cn(className)}
      onValueChange={(value) => setLanguage(value as Language)}
    >
      <TabsList>
        <TabsTrigger value="" disabled>
          <TranslateIcon />
        </TabsTrigger>
        {languages.map((lng) => (
          <TabsTrigger key={lng} value={lng}>
            {LANGUAGE_LABEL[lng]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
