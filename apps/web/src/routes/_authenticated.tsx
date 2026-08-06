import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useAuth } from "@/lib/context/auth"
import { LoginDialog } from "@/pages/auth/login/login-dialog"

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
})

function AuthGate() {
  const { user, isPending } = useAuth()

  if (isPending) return null

  if (!user) {
    return <LoginDialog />
  }

  return <Outlet />
}
