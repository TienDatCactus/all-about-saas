import { createFileRoute } from "@tanstack/react-router";
import EditSessionPage from "@/pages/badminton/edit";

export const Route = createFileRoute("/badminton/$sessionId")({
  staticData: { crumb: `Session Details` },
  component: RouteComponent,
});

function RouteComponent() {
  const { sessionId } = Route.useParams();
  return <EditSessionPage sessionId={sessionId} />;
}
