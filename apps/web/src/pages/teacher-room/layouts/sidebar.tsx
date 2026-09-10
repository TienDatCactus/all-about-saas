import { CalendarDotIcon, HouseIcon } from "@phosphor-icons/react"
import * as React from "react"
import { useTranslation } from "react-i18next"

import Logo from "@/components/custom/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "@/pages/teacher-room/layouts/components/NavMain"
import { NavSecondary } from "@/pages/teacher-room/layouts/components/NavSecondary"
import { NavUser } from "@/pages/teacher-room/layouts/components/NavUser"

export function TeacherRoomSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const data = {
    navMain: [
      {
        title: t("teacherRoom.sidebar.timetable"),
        url: "/teacher-room/timetable",
        icon: CalendarDotIcon,
      },
    ],
    navSecondary: [
      {
        title: t("teacherRoom.sidebar.backHome"),
        url: "/",
        icon: HouseIcon,
      },
    ],
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Logo alt="logo" className="w-12" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {t("teacherRoom.sidebar.title")}
                </span>
                <span className="truncate text-xs">
                  {t("teacherRoom.sidebar.subtitle")}
                </span>
              </div>
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
