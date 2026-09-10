import { useState } from "react"
import { InfoIcon } from "@phosphor-icons/react"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

export function ChangeVisibleHoursInput() {
  const { visibleHours, setVisibleHours } = useCalendar()

  const [from, setFrom] = useState(visibleHours.from)
  const [to, setTo] = useState(visibleHours.to)

  const handleApply = () => {
    setVisibleHours({ from, to: to === 0 ? 24 : to })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Change visible hours</p>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="size-3" />
            </TooltipTrigger>

            <TooltipContent className="max-w-80 text-center">
              <p>
                If an event falls outside the specified visible hours, the
                visible hours will automatically adjust to include that event.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-4">
        <p>From</p>
        <Input
          id="start-time"
          type="number"
          min={0}
          max={24}
          className="w-16"
          value={from}
          onChange={(e) =>
            !Number.isNaN(e.target.valueAsNumber) &&
            setFrom(e.target.valueAsNumber)
          }
        />
        <p>To</p>
        <Input
          id="end-time"
          type="number"
          min={0}
          max={24}
          className="w-16"
          value={to}
          onChange={(e) =>
            !Number.isNaN(e.target.valueAsNumber) &&
            setTo(e.target.valueAsNumber)
          }
        />
      </div>

      <Button className="mt-4 w-fit" onClick={handleApply}>
        Apply
      </Button>
    </div>
  )
}
