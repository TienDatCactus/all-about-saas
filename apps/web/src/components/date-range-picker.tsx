"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { type DateRange } from "react-day-picker";

export interface DateRangePickerProps {
  /** Controlled selected range. Pass this together with `onChange`. */
  value?: DateRange;
  /** Initial range when used uncontrolled (no `value`/`onChange`). */
  defaultValue?: DateRange;
  /** Fired when the user changes or clears the range. */
  onChange?: (range: DateRange | undefined) => void;
  /** Fired when the popover closes — wire to TanStack Form's `field.handleBlur`. */
  onBlur?: () => void;
  /** date-fns format for the trigger labels. @default "LLL dd, y" */
  displayFormat?: string;
  placeholder?: string;
  numberOfMonths?: number;
  disabled?: boolean;
  /** Forwarded to the trigger so a `<FieldLabel htmlFor>` can target it. */
  id?: string;
  name?: string;
  "aria-invalid"?: boolean;
  className?: string;
}

export default function DateRangePicker({
  value,
  defaultValue,
  onChange,
  onBlur,
  displayFormat = "LLL dd, y",
  placeholder = "Pick a date",
  numberOfMonths = 2,
  disabled,
  id,
  name,
  "aria-invalid": ariaInvalid,
  className,
}: DateRangePickerProps) {
  const isControlled = value !== undefined || onChange !== undefined;
  const [internal, setInternal] = React.useState<DateRange | undefined>(
    defaultValue,
  );
  const [open, setOpen] = React.useState(false);

  const range = isControlled ? value : internal;

  const handleSelect = (next: DateRange | undefined) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
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
              !range && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, displayFormat)} -{" "}
                  {format(range.to, displayFormat)}
                </>
              ) : (
                format(range.from, displayFormat)
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
