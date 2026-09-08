import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/teacher-room")({
  staticData: { crumb: "Teacher room" },
  component: () => <Outlet />,
})
