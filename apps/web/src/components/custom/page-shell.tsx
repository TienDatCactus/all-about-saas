import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from "../ui/button";
import { CaretDownIcon } from "@phosphor-icons/react";
import { Breadcrumbs } from "./breadcrumb";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh w-full self-start">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 py-8 md:p-8">
        {children}
      </div>
    </main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <Popover>
          <div className="flex items-center">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <PopoverTrigger asChild>
              <Button variant={"ghost"} size={"icon"}>
                <CaretDownIcon />
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent className="w-fit">
            <Breadcrumbs />
          </PopoverContent>
        </Popover>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
