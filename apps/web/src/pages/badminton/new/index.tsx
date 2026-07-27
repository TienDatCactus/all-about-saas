import { useNavigate } from "@tanstack/react-router";
import { SessionEditor } from "../components/session-editor";
import { PageHeader, PageShell } from "../../../components/custom/page-shell";

export default function NewSessionPage() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHeader
        title="New session"
        description="Enter the costs and players — the split updates live."
      />
      <SessionEditor
        onSaved={(session) =>
          navigate({
            to: "/badminton/$sessionId",
            params: { sessionId: session.id },
          })
        }
      />
    </PageShell>
  );
}
