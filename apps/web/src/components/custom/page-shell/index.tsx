import { DesktopTowerIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { Button } from "../../ui/button"
import { LanguageToggler } from "./language-toggle"
import RouteDropdown from "./route-dropdown"
import { ThemeToggler } from "./theme-toggle"
import { UserMenu } from "./user-menu"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

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
  return (
    <header
      className={cn(
        // flex-wrap + auto height below `sm`: the left (brand/nav) and right
        // (language/theme/user) clusters both refuse to shrink, so below
        // ~480px combined they no longer fit on one row. Without wrap, the
        // right cluster — including sign-out — was pushed past the
        // viewport edge with no scrollbar to reach it.
        "flex h-auto min-h-12 w-full flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 sm:h-12 sm:flex-nowrap sm:py-0",
        !compact && "sticky top-0 z-100 bg-background"
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        {actions ?? actions}
        {actions ? <Separator orientation="vertical" /> : null}
        <Button variant="ghost" className="font-semibold">
          <DesktopTowerIcon />
          All about Saas
        </Button>
        <RouteDropdown />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* <Separator orientation="vertical" /> */}
        <LanguageToggler />
        <ThemeToggler />
        <UserMenu />
      </div>
    </header>
  )
}
