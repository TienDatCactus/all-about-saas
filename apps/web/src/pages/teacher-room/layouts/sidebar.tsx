import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  CalendarDotIcon,
  ChalkboardTeacherIcon,
  HouseIcon,
} from "@phosphor-icons/react"

import { NavMain } from "@/pages/teacher-room/layouts/components/nav-main"
import { NavSecondary } from "@/pages/teacher-room/layouts/components/nav-secondary"
import { NavUser } from "@/pages/teacher-room/layouts/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Lịch dạy",
      url: "/teacher-room/timetable",
      icon: CalendarDotIcon,
    },
  ],
  navSecondary: [
    {
      title: "Về trang chủ",
      url: "/",
      icon: HouseIcon,
    },
  ],
}

export function TeacherRoomSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/teacher-room/timetable">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ChalkboardTeacherIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Teacher room</span>
                  <span className="truncate text-xs">Lịch dạy động</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
