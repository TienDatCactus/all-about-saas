import { createFileRoute } from "@tanstack/react-router"
import ChatPage from "@/pages/chat"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})
