import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/badminton")({
  staticData: { crumb: "Badminton" },
  component: () => <Outlet />,
})
