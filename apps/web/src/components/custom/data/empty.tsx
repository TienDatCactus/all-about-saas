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

interface DataEmptyProp {
  media?: Media
  title: string
  description?: string
  content?: React.ReactNode
  className?: string
}

export default function DataEmpty({
  media,
  title,
  description,
  content,
  className,
}: DataEmptyProp) {
  return (
    <Empty className={cn(className)}>
      <EmptyHeader>
        {media && (
          <EmptyMedia variant={media.variant}>
            {media.variant === "icon" ? media.icon : media.media}
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {content && <EmptyContent>{content}</EmptyContent>}
    </Empty>
  )
}
