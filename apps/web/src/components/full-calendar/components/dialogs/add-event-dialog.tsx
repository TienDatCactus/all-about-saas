import { cloneElement, isValidElement } from "react"
import { useForm } from "@tanstack/react-form"
import { format } from "date-fns"

import { useDisclosure } from "@/hooks/use-disclosure"
import { useCreateAdHocSessionMutation } from "@/services/teacher-room/queries"

import { Textarea } from "@/components/ui/textarea"
import { SingleDayPicker } from "@/components/ui/single-day-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { FormField } from "@/components/custom/form-field"
import { toast } from "@/components/custom/toast"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import DataDialog from "@/components/custom/data/dialog"

import { StudentCombobox } from "./student-combobox"

interface AddEventFormValues {
  studentName: string
  scheduledDate: Date | undefined
  startTime: string
  endTime: string
  note: string
}

interface IProps {
  children: React.ReactNode
  startDate?: Date
  startTime?: { hour: number; minute: number }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** +60min from a grid click, clamped to the same day. */
function defaultEndTime(hour: number, minute: number) {
  const end = new Date(2000, 0, 1, hour, minute + 60)
  return `${pad(end.getHours())}:${pad(end.getMinutes())}`
}

export function AddEventDialog({ children, startDate, startTime }: IProps) {
  const { isOpen, onOpen, onClose, onToggle } = useDisclosure()
  const createSession = useCreateAdHocSessionMutation()

  const form = useForm({
    defaultValues: {
      studentName: "",
      scheduledDate: startDate,
      startTime: startTime
        ? `${pad(startTime.hour)}:${pad(startTime.minute)}`
        : "15:00",
      endTime: startTime
        ? defaultEndTime(startTime.hour, startTime.minute)
        : "16:00",
      note: "",
    } as AddEventFormValues,
    onSubmit: async ({ value }) => {
      if (!value.studentName.trim()) {
        toast.error("Cần nhập tên học sinh")
        throw new Error("studentName required")
      }
      if (!value.scheduledDate) {
        toast.error("Cần chọn ngày dạy")
        throw new Error("scheduledDate required")
      }
      // Zero-padded 'HH:mm' from <input type="time"> compares lexically.
      if (value.endTime <= value.startTime) {
        toast.error("Giờ kết thúc phải sau giờ bắt đầu")
        throw new Error("endTime must be after startTime")
      }
      await createSession.mutateAsync({
        studentName: value.studentName,
        scheduledDate: format(value.scheduledDate, "yyyy-MM-dd"),
        startTime: value.startTime,
        endTime: value.endTime,
        note: value.note || undefined,
      })
      onClose()
      form.reset()
    },
  })

  return (
    <>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<any>, { onClick: onOpen })
        : children}

      <DataDialog
        open={isOpen}
        onOpenChange={(next) => {
          onToggle()
          if (!next) form.reset()
        }}
        title="Thêm buổi dạy"
        content={
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit().catch(() => undefined)
            }}
          >
            <FormField form={form} name="studentName" label="Học sinh">
              {({ field }) => (
                <StudentCombobox
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </FormField>

            <FormField form={form} name="scheduledDate" label="Ngày dạy">
              {({ field }) => (
                <SingleDayPicker
                  value={field.state.value}
                  onSelect={field.handleChange}
                  placeholder="Chọn ngày"
                />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField form={form} name="startTime" label="Giờ bắt đầu">
                {({ inputProps }) => <TimePicker {...inputProps} />}
              </FormField>
              <FormField form={form} name="endTime" label="Giờ kết thúc">
                {({ inputProps }) => <TimePicker {...inputProps} />}
              </FormField>
            </div>

            <FormField form={form} name="note" label="Ghi chú (tuỳ chọn)">
              {({ field }) => (
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </FormField>

            <StatefulButton
              type="button"
              mutationState={createSession.status}
              onClick={form.handleSubmit}
            >
              Tạo buổi dạy
            </StatefulButton>
          </form>
        }
      />
    </>
  )
}
