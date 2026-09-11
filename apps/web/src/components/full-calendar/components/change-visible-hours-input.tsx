import { useState } from "react"
import { InfoIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  const { visibleHours, setVisibleHours } = useCalendar()

  const [from, setFrom] = useState(visibleHours.from)
  const [to, setTo] = useState(visibleHours.to)

  const handleApply = () => {
    setVisibleHours({ from, to: to === 0 ? 24 : to })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">
          {t("calendar.visibleHours.title")}
        </p>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="size-3" />
            </TooltipTrigger>

            <TooltipContent className="max-w-80 text-center">
              <p>{t("calendar.visibleHours.tooltip")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-4">
        <p>{t("calendar.visibleHours.from")}</p>
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
        <p>{t("calendar.visibleHours.to")}</p>
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
        {t("calendar.visibleHours.apply")}
      </Button>
    </div>
  )
}
