import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/custom/form-field"
import { toast } from "@/components/custom/toast"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useForm } from "@tanstack/react-form"
import {
  useCreateSlotMutation,
  useUpdateSlotMutation,
} from "@/services/teacher-room/queries"
import { StudentCombobox } from "./student-combobox"
import type { WeeklyScheduleSlot } from "@/services/teacher-room/types"

const DAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]

interface SlotFormValues {
  studentName: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function SlotEditorDialog({
  slot,
  open,
  onOpenChange,
}: {
  slot?: WeeklyScheduleSlot
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateSlotMutation()
  const update = useUpdateSlotMutation()
  const status = slot ? update.status : create.status

  const form = useForm({
    defaultValues: slot
      ? {
          studentName: slot.student?.name ?? "",
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }
      : { studentName: "", dayOfWeek: 1, startTime: "15:00", endTime: "16:00" },
    onSubmit: async ({ value }: { value: SlotFormValues }) => {
      // Zero-padded 'HH:mm' from <input type="time"> compares lexically.
      if (value.endTime <= value.startTime) {
        toast.error("Giờ kết thúc phải sau giờ bắt đầu")
        return
      }
      const { studentName, ...schedule } = value
      if (slot) {
        await update.mutateAsync({ id: slot.id, data: schedule })
      } else {
        await create.mutateAsync(value)
      }
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {slot ? "Sửa lịch học" : "Thêm lịch học hàng tuần"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit().catch(() => undefined)
          }}
        >
          {!slot && (
            <FormField form={form} name="studentName" label="Học sinh">
              {({ field }) => (
                <StudentCombobox
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </FormField>
          )}
          <FormField form={form} name="dayOfWeek" label="Thứ">
            {({ field }) => (
              <Select
                value={String(field.state.value)}
                onValueChange={(v) => field.handleChange(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField form={form} name="startTime" label="Giờ bắt đầu">
              {({ field }) => (
                <Input
                  type="time"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </FormField>
            <FormField form={form} name="endTime" label="Giờ kết thúc">
              {({ field }) => (
                <Input
                  type="time"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <StatefulButton type="submit" mutationState={status}>
            Lưu
          </StatefulButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
