import { CheckIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { languages, type Language } from "@/lib/i18n"
import { useLanguage } from "@/lib/context/language"

const LANGUAGE_META: Record<Language, { flag: string; label: string }> = {
  vi: { flag: "🇻🇳", label: "Tiếng Việt" },
  en: { flag: "🇬🇧", label: "English" },
}

export function LanguageToggler({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn(className)}>
          <span aria-hidden="true">{LANGUAGE_META[language].flag}</span>
          <span className="sr-only">{LANGUAGE_META[language].label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lng) => (
          <DropdownMenuItem key={lng} onClick={() => setLanguage(lng)}>
            <span aria-hidden="true">{LANGUAGE_META[lng].flag}</span>
            {LANGUAGE_META[lng].label}
            {lng === language && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
