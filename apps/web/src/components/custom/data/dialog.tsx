import type React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

interface DataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  content: React.ReactNode
}

/**
 * Same overlay, two shells: a centered Dialog on desktop, a bottom Drawer on
 * mobile (where a modal dialog is cramped and a sheet is the native pattern).
 * Callers own `open` state and just hand over `content` — no branching on
 * viewport at the call site.
 */
export default function DataDialog({
  open,
  onOpenChange,
  title,
  description,
  content,
}: DataDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 py-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
