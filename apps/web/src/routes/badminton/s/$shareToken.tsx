import { createFileRoute } from "@tanstack/react-router";
import PublicSessionPage from "@/pages/badminton/share";

export const Route = createFileRoute("/badminton/s/$shareToken")({
  component: RouteComponent,
});

function RouteComponent() {
  const { shareToken } = Route.useParams();
  return <PublicSessionPage shareToken={shareToken} />;
}
