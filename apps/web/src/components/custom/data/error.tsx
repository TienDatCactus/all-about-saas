import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { WarningIcon } from "@phosphor-icons/react"
import type React from "react"
type Media =
  | {
      variant: "icon"
      icon: React.ReactNode
    }
  | {
      variant: "default"
      media: React.ReactNode
    }

interface DataErrorProp {
  /** Defaults to a warning icon; pass media to override. */
  media?: Media
  title: string
  description?: string
  content?: React.ReactNode
  className?: string
}

export default function DataError({
  media = { variant: "icon", icon: <WarningIcon /> },
  title,
  description,
  content,
  className,
}: DataErrorProp) {
  return (
    <Empty
      role="alert"
      className={cn(
        "border border-destructive/20 bg-destructive/5",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant={media.variant}
          className={
            media.variant === "icon"
              ? "bg-destructive/10 text-destructive"
              : undefined
          }
        >
          {media.variant === "icon" ? media.icon : media.media}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {content && <EmptyContent>{content}</EmptyContent>}
    </Empty>
  )
}
