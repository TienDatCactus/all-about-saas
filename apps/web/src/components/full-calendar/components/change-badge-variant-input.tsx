"use client"

import { useTranslation } from "react-i18next"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ChangeBadgeVariantInput() {
  const { t } = useTranslation()
  const { badgeVariant, setBadgeVariant } = useCalendar()

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">
        {t("calendar.badgeVariant.label")}
      </p>

      <Select value={badgeVariant} onValueChange={setBadgeVariant}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="dot">{t("calendar.badgeVariant.dot")}</SelectItem>
          <SelectItem value="colored">
            {t("calendar.badgeVariant.colored")}
          </SelectItem>
          <SelectItem value="mixed">
            {t("calendar.badgeVariant.mixed")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
