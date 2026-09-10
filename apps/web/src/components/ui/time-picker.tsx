import * as React from "react"
import { ClockIcon } from "@phosphor-icons/react"

import { AddonInput } from "@/components/custom/addon-input"
import { cn } from "@/lib/utils"

export type TimePickerProps = Omit<
  React.ComponentProps<typeof AddonInput>,
  "type" | "startAddon"
>

/**
 * Native `<input type="time">`, styled to match this repo's addon-input
 * family — a clock icon in place of the browser's own calendar-picker
 * indicator. Plain `value`/`onChange` (native input shape), so it drops
 * into `FormField` exactly like `Input`/`Textarea`:
 *
 *   <FormField form={form} name="startTime" label="Giờ bắt đầu">
 *     {({ inputProps }) => <TimePicker {...inputProps} />}
 *   </FormField>
 */
export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className, ...props }, ref) => (
    <AddonInput
      type="time"
      startAddon={<ClockIcon />}
      ref={ref}
      className={cn(
        "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className
      )}
      {...props}
    />
  )
)
TimePicker.displayName = "TimePicker"
