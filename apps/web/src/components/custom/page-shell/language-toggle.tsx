import { GlobeIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { languages, type Language } from "@/lib/i18n"
import { useLanguage } from "@/lib/context/language"

const LANGUAGE_LABEL: Record<Language, string> = {
  vi: "VI",
  en: "EN",
}

export function LanguageToggler({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <GlobeIcon />
      </div>
      <Tabs
        value={language}
        onValueChange={(value) => setLanguage(value as Language)}
      >
        <TabsList>
          {languages.map((lng) => (
            <TabsTrigger key={lng} value={lng}>
              {LANGUAGE_LABEL[lng]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
