import { DesktopTowerIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import RouteDropdown from "./route-dropdown";
import { ThemeToggler } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** "/auth/sign-up" → "Sign up", "/badminton/$sessionId" → "sessionId", "/" → "Home". */

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="@container flex min-h-screen w-full items-start justify-center">
      <div className="flex w-full flex-col">
        <header className="sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="ghost" className="font-semibold">
              <DesktopTowerIcon />
              All about Saas
            </Button>
            <RouteDropdown />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Separator orientation="vertical" />
            <ThemeToggler />
            <UserMenu />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </div>
    </main>
  );
}
