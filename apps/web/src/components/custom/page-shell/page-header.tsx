import { Button } from "@/components/ui/button"
import { InfoIcon } from "@phosphor-icons/react"
import { type ReactNode } from "react"
import { Breadcrumbs } from "../breadcrumb"
import { DataHoverCard } from "../data/hover-card"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <sup>
            <DataHoverCard
              content={<Breadcrumbs />}
              side="bottom"
              align="start"
            >
              <Button size="icon" variant="ghost">
                <InfoIcon />
              </Button>
            </DataHoverCard>
          </sup>
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  )
}
