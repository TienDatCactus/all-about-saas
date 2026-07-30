import { createFileRoute } from "@tanstack/react-router";
import EditSessionPage from "@/pages/badminton/edit";

export const Route = createFileRoute("/badminton/$sessionId")({
  staticData: { crumb: (c) => `Session ${c.params.sessionId.slice(0, 8)}` },
  component: RouteComponent,
});

function RouteComponent() {
  const { sessionId } = Route.useParams();
  return <EditSessionPage sessionId={sessionId} />;
}
