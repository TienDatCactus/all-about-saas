import { ShellHeader } from "@/components/custom/page-shell"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TeacherRoomSidebar } from "@/pages/teacher-room/layouts/sidebar"
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/teacher-room")({
  staticData: { crumb: "Teacher room" },
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
})
