import { createFileRoute } from "@tanstack/react-router"
import SlotListPage from "@/pages/teacher-room/slots/list"

export const Route = createFileRoute("/_authenticated/teacher-room/slots/")({
  staticData: { crumb: "Lịch học hàng tuần" },
  component: SlotListPage,
})
