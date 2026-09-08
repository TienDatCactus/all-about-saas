import { useState } from "react"
import { PlusIcon, PencilIcon, CalendarIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import DataPage from "@/components/custom/data/page"
import {
  useSlotsQuery,
  useUpdateSlotMutation,
} from "@/services/teacher-room/queries"
import { SlotEditorDialog } from "../components/slot-editor-dialog"
import type { WeeklyScheduleSlot } from "@/services/teacher-room/types"

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

export default function SlotListPage() {
  const slotsQuery = useSlotsQuery()
  const updateSlot = useUpdateSlotMutation()
  const [editing, setEditing] = useState<
    WeeklyScheduleSlot | "new" | undefined
  >()
  const [dialogKey, setDialogKey] = useState(0)

  function openDialog(target: WeeklyScheduleSlot | "new") {
    setEditing(target)
    setDialogKey((k) => k + 1)
  }

  const slots = [...(slotsQuery.data?.data ?? [])].sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      (a.student?.name ?? "").localeCompare(b.student?.name ?? "")
  )

  return (
    <>
      <DataPage
        query={slotsQuery}
        title="Lịch học hàng tuần"
        description="Lịch cố định theo tuần cho từng học sinh."
        actions={
          <Button onClick={() => openDialog("new")}>
            <PlusIcon data-icon="inline-start" />
            Thêm lịch học
          </Button>
        }
        error={{ title: "Không tải được lịch học hàng tuần" }}
        isEmpty={() => slots.length === 0}
        empty={{
          media: { variant: "icon", icon: <CalendarIcon /> },
          title: "Chưa có lịch học nào",
          content: (
            <Button onClick={() => openDialog("new")}>Thêm lịch học</Button>
          ),
        }}
      >
        {() => (
          <ul className="flex flex-col gap-2">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span>
                  <span className="font-medium">{slot.student?.name}</span>
                  {" · "}
                  {DAYS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={slot.active}
                    onCheckedChange={(active) =>
                      updateSlot.mutate({ id: slot.id, data: { active } })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openDialog(slot)}
                  >
                    <PencilIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataPage>
      <SlotEditorDialog
        key={dialogKey}
        slot={editing === "new" ? undefined : editing}
        open={editing !== undefined}
        onOpenChange={(open: boolean) => !open && setEditing(undefined)}
      />
    </>
  )
}
