import NewSessionPage from "@/pages/badminton/new"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/badminton/new")({
  staticData: { crumb: "New session" },
  component: NewSessionPage,
})
