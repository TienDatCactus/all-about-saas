import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SingleDayPicker } from "@/components/ui/single-day-picker"

interface DateTimePickerProps {
  dateId?: string
  timeId?: string
  dateLabel?: string
  timeLabel?: string
  datePlaceholder?: string
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  /** 'HH:mm', matching native `<input type="time">`. */
  time: string
  onTimeChange: (time: string) => void
  className?: string
}

/**
 * Date + time side by side, one Field row — for a single scheduled moment.
 * Built on this repo's own date (SingleDayPicker) and time (native
 * `<input type="time">`) primitives rather than a standalone widget, so it
 * stays consistent with every other date/time field in the app.
 */
export function DateTimePicker({
  dateId = "date-picker",
  timeId = "time-picker",
  dateLabel = "Ngày",
  timeLabel = "Giờ",
  datePlaceholder = "Chọn ngày",
  date,
  onDateChange,
  time,
  onTimeChange,
  className,
}: DateTimePickerProps) {
  return (
    <FieldGroup className={className ?? "flex-row"}>
      <Field className="flex-1">
        <FieldLabel htmlFor={dateId}>{dateLabel}</FieldLabel>
        <SingleDayPicker
          id={dateId}
          value={date}
          onSelect={onDateChange}
          placeholder={datePlaceholder}
        />
      </Field>
      <Field className="w-32">
        <FieldLabel htmlFor={timeId}>{timeLabel}</FieldLabel>
        <Input
          id={timeId}
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
