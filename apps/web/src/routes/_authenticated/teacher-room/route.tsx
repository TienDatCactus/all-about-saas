import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import DataEmpty from "@/components/custom/data/empty"
import DataError from "@/components/custom/data/error"
import { ShellHeader } from "@/components/custom/page-shell"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import i18n from "@/lib/i18n"
import { TeacherRoomSidebar } from "@/pages/teacher-room/layouts/sidebar"

function TeacherRoomNotFound() {
  const { t } = useTranslation()
  return (
    <DataEmpty
      media={{ variant: "icon", icon: <MagnifyingGlassIcon /> }}
      title={t("common.routeNotFound.title")}
      description={t("teacherRoom.notFound.description")}
    />
  )
}

function TeacherRoomError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation()
  return (
    <DataError
      title={t("common.routeError.title")}
      description={error.message || t("common.routeError.description")}
      content={
        <Button variant="outline" onClick={() => reset()}>
          {t("common.routeError.tryAgain")}
        </Button>
      }
    />
  )
}

export const Route = createFileRoute("/_authenticated/teacher-room")({
  staticData: { crumb: () => i18n.t("teacherRoom.sidebar.title") },
  component: () => (
    <SidebarProvider>
      <TeacherRoomSidebar />
      <SidebarInset>
        <ShellHeader compact actions={<SidebarTrigger />} />
        {/* min-w-0: flex items default to min-width:auto, so without it this
            never shrinks below its content's intrinsic width — a table or
            button row that's slightly too wide for the space beside the
            sidebar pushes the whole page wider instead of being contained
            (and reacted to via @container, see full-calendar's ClientContainer). */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  notFoundComponent: TeacherRoomNotFound,
  errorComponent: TeacherRoomError,
})
