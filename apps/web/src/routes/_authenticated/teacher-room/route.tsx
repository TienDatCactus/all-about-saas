import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/custom/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TeacherRoomSidebar } from "@/pages/teacher-room/layouts/sidebar";
import { ShellHeader } from "@/components/custom/page-shell";

export const Route = createFileRoute("/_authenticated/teacher-room")({
  staticData: { crumb: "Teacher room" },
  component: () => (
    <SidebarProvider>
      <TeacherRoomSidebar />
      <SidebarInset>
        <ShellHeader
          compact
          actions={
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4"
              />
            </div>
          }
        />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
});
