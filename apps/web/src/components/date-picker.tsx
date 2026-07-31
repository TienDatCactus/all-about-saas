"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  /** Controlled selected date. Pass this together with `onChange`. */
  value?: Date
  /** Initial date when used uncontrolled (no `value`/`onChange`). */
  defaultValue?: Date
  /** Fired when the user picks or clears a date. */
  onChange?: (date: Date | undefined) => void
  /** Fired when the popover closes — wire to TanStack Form's `field.handleBlur`. */
  onBlur?: () => void
  /** date-fns format for the trigger label. @default "PPP" */
  displayFormat?: string
  placeholder?: string
  disabled?: boolean
  /** Forwarded to the trigger so a `<FieldLabel htmlFor>` can target it. */
  id?: string
  name?: string
  "aria-invalid"?: boolean
  className?: string
}

export default function DatePicker({
  value,
  defaultValue,
  onChange,
  onBlur,
  displayFormat = "PPP",
  placeholder = "Pick a date",
  disabled,
  id,
  name,
  "aria-invalid": ariaInvalid,
  className,
}: DatePickerProps) {
  const isControlled = value !== undefined || onChange !== undefined
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue)
  const [open, setOpen] = React.useState(false)

  const selected = isControlled ? value : internal

  const handleSelect = (date: Date | undefined) => {
    if (!isControlled) setInternal(date)
    onChange?.(date)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Popover closing is the natural "blur" for a picker.
        if (!next) onBlur?.()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          name={name}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? (
            format(selected, displayFormat)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
