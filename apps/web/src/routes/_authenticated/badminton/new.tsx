import { createFileRoute } from "@tanstack/react-router"
import NewSessionPage from "@/pages/badminton/new"

export const Route = createFileRoute("/_authenticated/badminton/new")({
  staticData: { crumb: "New session" },
  component: NewSessionPage,
})
