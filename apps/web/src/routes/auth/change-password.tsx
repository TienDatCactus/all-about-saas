import { createFileRoute } from "@tanstack/react-router"
import ChangePassword from "@/pages/auth/change-password"
import { ResetPasswordSchema } from "@/services/auth"

// Despite the route name, this page completes a forgotten-password *reset* — the
// selector/token in the query string are the credential. ChangePasswordSchema is
// now the in-session flow and has no such params.
export const Route = createFileRoute("/auth/change-password")({
  component: RouteComponent,
  validateSearch: ResetPasswordSchema.pick({
    selector: true,
    token: true,
    type: true,
  }),
})

function RouteComponent() {
  return <ChangePassword />
}
