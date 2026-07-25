import { createFileRoute } from "@tanstack/react-router";
import NewSessionPage from "@/pages/badminton/new";

export const Route = createFileRoute("/badminton/new")({
  component: NewSessionPage,
});
