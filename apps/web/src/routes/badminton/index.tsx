import { createFileRoute } from "@tanstack/react-router";
import SessionListPage from "@/pages/badminton/list";

export const Route = createFileRoute("/badminton/")({
  component: SessionListPage,
});
