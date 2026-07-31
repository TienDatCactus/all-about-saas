import { createFileRoute } from "@tanstack/react-router"
import ResetPassword from "@/pages/auth/reset-password"

export const Route = createFileRoute("/auth/reset-password")({
  component: RouteComponent,
})

function RouteComponent() {
  return <ResetPassword />
}
