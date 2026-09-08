import { ListIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../../ui/button"
import Logo from "../logo"
import { LanguageToggler } from "./language-toggle"
import RouteDropdown from "./route-dropdown"
import { ThemeToggler } from "./theme-toggle"
import { UserMenu } from "./user-menu"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/** "/auth/sign-up" → "Sign up", "/badminton/$sessionId" → "sessionId", "/" → "Home". */

export function PageShell({
  children,
  rounded,
}: {
  children: ReactNode
  rounded?: boolean
}) {
  return (
    <main className="@container flex h-dvh w-full items-start justify-center">
      <div className="flex min-h-screen w-full flex-col">
        <ShellHeader />
        <div
          className={cn(
            "flex flex-1 flex-col p-4",
            rounded
              ? "gap-4 pt-0"
              : "relative h-full min-h-0 w-full overflow-auto bg-background"
          )}
        >
          {children}
        </div>
      </div>
    </main>
  )
}

export function ShellHeader({
  actions,
  compact,
}: {
  actions?: ReactNode
  compact?: boolean
}) {
  const { t } = useTranslation()
  return (
    <header
      className={cn(
        "flex h-12 w-full items-center justify-between gap-2 border-b border-border px-4",
        !compact && "sticky top-0 z-100 bg-background"
      )}
    >
      <div className="flex min-w-0 shrink items-center gap-3">
        {actions ?? actions}
        {actions ? <Separator orientation="vertical" /> : null}
        <Logo alt="All about Saas" className="w-8 shrink-0" />
        <div className="hidden md:block">
          <RouteDropdown />
        </div>
      </div>
      {/* Below `md` (768px — same cutover as useIsMobile, which RouteDropdown
          itself reads) the page navigator + language/theme/user cluster move
          into a top-down Sheet instead of wrapping or shrinking off-screen —
          there isn't enough width beside the brand to keep them inline. */}
      <div className="hidden shrink-0 items-center gap-3 md:flex">
        <LanguageToggler />
        <ThemeToggler />
        <UserMenu />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
            <ListIcon />
            <span className="sr-only">{t("common.shellHeader.openMenu")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="top">
          <SheetHeader>
            <SheetTitle>{t("common.shellHeader.menu")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 p-6 pt-0">
            <RouteDropdown />
            <div className="flex items-center gap-3">
              <LanguageToggler />
              <ThemeToggler />
              <UserMenu />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
