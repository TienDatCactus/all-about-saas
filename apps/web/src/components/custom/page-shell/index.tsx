import { DesktopTowerIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { Button } from "../../ui/button"
import RouteDropdown from "./route-dropdown"
import { ThemeToggler } from "./theme-toggle"
import { UserMenu } from "./user-menu"

/** "/auth/sign-up" → "Sign up", "/badminton/$sessionId" → "sessionId", "/" → "Home". */

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="@container flex h-dvh w-full items-start justify-center">
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-100 flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="ghost" className="font-semibold">
              <DesktopTowerIcon />
              All about Saas
            </Button>
            <RouteDropdown />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* <Separator orientation="vertical" /> */}
            <ThemeToggler />
            <UserMenu />
          </div>
        </header>
        {/* flex-col so a page can center itself with m-auto — percentage
            heights (h-full/min-h-full) can't resolve here because the column
            above sizes itself with min-h-screen (indefinite height). */}
        <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-auto bg-background p-4">
          {children}
        </div>
      </div>
    </main>
  )
}
