import * as React from "react"
import { Link } from "@tanstack/react-router"
import { CalendarDotIcon, HouseIcon } from "@phosphor-icons/react"

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
import Logo from "@/components/custom/logo"

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
                <Logo alt="logo" className="h-12 w-12" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Teacher room</span>
                  <span className="truncate text-xs">
                    Quản lý lịch dạy & lớp học
                  </span>
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
