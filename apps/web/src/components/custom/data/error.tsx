import { WarningIcon } from "@phosphor-icons/react"
import type React from "react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

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
  media: mediaProp,
  title,
  description,
  content,
  className,
}: DataErrorProp) {
  // Resolved here rather than as a destructuring default: React Compiler
  // cannot safely reorder an ObjectExpression used as a default value in a
  // destructuring pattern (BuildHIR::node.lowerReorderableExpression).
  // `=== undefined` (not `??`), to match a destructuring default's actual
  // semantics — a default fires only on undefined, and `??` firing on null
  // too would be an observable behavior change for a `media={null}` caller.
  const media =
    mediaProp === undefined
      ? { variant: "icon" as const, icon: <WarningIcon /> }
      : mediaProp
  return (
    <Empty
      role="alert"
      className={cn("border border-destructive/20 bg-destructive/5", className)}
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
