import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/custom/form-field"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import { useForm } from "@tanstack/react-form"
import { useCreateAdHocSessionMutation } from "@/services/teacher-room/queries"
import { StudentCombobox } from "@/pages/teacher-room/slots/components/student-combobox"

interface AdHocFormValues {
  studentName: string
  startTime: string
  endTime: string
}

export function AdHocSessionDialog({
  scheduledDate,
  open,
  onOpenChange,
}: {
  scheduledDate: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateAdHocSessionMutation()

  const form = useForm({
    defaultValues: {
      studentName: "",
      startTime: "15:00",
      endTime: "16:00",
    } as AdHocFormValues,
    onSubmit: async ({ value }: { value: AdHocFormValues }) => {
      await create.mutateAsync({ scheduledDate, ...value })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm buổi ({scheduledDate})</DialogTitle>
        </DialogHeader>
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
          <StatefulButton type="submit" mutationState={create.status}>
            Lưu
          </StatefulButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
