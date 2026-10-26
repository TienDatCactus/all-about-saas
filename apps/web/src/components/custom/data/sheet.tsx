import type React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export interface DataSheetProps {
  /** Rendered via Radix `asChild` — must accept a forwarded ref and spread props. */
  trigger?: React.ReactElement
  title: React.ReactNode
  description?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  children: React.ReactNode
  contentClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Shared Sheet shell: trigger + title/description + content, so callers stop
 * repeating the Sheet/SheetTrigger/SheetHeader/SheetTitle boilerplate. Pass
 * `open`/`onOpenChange` instead of `trigger` for a controlled sheet.
 */
export function DataSheet({
  trigger,
  title,
  description,
  side = "right",
  children,
  contentClassName,
  open,
  onOpenChange,
}: DataSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side={side} className={contentClassName}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
