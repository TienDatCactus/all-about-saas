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

export const Route = createFileRoute("/_authenticated/teacher-room")({
  staticData: { crumb: () => i18n.t("teacherRoom.sidebar.title") },
  component: () => (
    <SidebarProvider>
      <TeacherRoomSidebar />
      <SidebarInset>
        <ShellHeader compact actions={<SidebarTrigger />} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  notFoundComponent: () => {
    const { t } = useTranslation()
    return (
      <DataEmpty
        media={{ variant: "icon", icon: <MagnifyingGlassIcon /> }}
        title={t("teacherRoom.notFound.title")}
        description={t("teacherRoom.notFound.description")}
      />
    )
  },
  errorComponent: ({ error, reset }) => {
    const { t } = useTranslation()
    return (
      <DataError
        title={t("teacherRoom.error.title")}
        description={error.message || t("teacherRoom.error.description")}
        content={
          <Button variant="outline" onClick={() => reset()}>
            {t("teacherRoom.error.tryAgain")}
          </Button>
        }
      />
    )
  },
})
