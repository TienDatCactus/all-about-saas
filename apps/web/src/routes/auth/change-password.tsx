import ChangePassword from "@/pages/auth/change-password";
import { ChangePasswordSchema } from "@/services/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/change-password")({
  component: RouteComponent,
  validateSearch: ChangePasswordSchema.pick({
    selector: true,
    token: true,
    type: true,
  }),
});

function RouteComponent() {
  return <ChangePassword />;
}
