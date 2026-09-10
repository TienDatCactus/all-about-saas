import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/context/language"

export function LanguageToggler({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("uppercase", className)}
      onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
    >
      {language}
    </Button>
  )
}
