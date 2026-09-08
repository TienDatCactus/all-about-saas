import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SessionCard } from "./session-card"
import type { TeachingSession } from "@/services/teacher-room/types"
import type { ReactNode } from "react"

export function SessionDetailDialog({
  session,
  children,
}: {
  session: TeachingSession
  children: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session.student?.name}</DialogTitle>
        </DialogHeader>
        <SessionCard session={session} />
      </DialogContent>
    </Dialog>
  )
}
