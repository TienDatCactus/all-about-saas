import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SheetClose } from "@/components/ui/sheet"
import { DataSheet } from "@/components/custom/data/sheet"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchParamsSetter } from "@/hooks/use-search-params-setter"
import type { IEvent } from "../../interfaces"
import type { TCalendarView } from "../../types"
import { TodayButton } from "./today-button"
import { DateNavigator } from "./date-navigator"
import {
  CalendarDotIcon,
  CaretDownIcon,
  ColumnsIcon,
  GearIcon,
  GridFourIcon,
  GridNineIcon,
  ListIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { AddEventDialog } from "../dialogs/add-event-dialog"
import { ChangeBadgeVariantInput } from "../change-badge-variant-input"
import { ChangeWorkingHoursInput } from "../change-working-hours-input"
import { ChangeVisibleHoursInput } from "../change-visible-hours-input"
import { ButtonGroup } from "@/components/ui/button-group"

interface IProps {
  view: TCalendarView
  events: IEvent[]
}

export function CalendarHeader({ view, events }: IProps) {
  const { t } = useTranslation()
  const setSearchParams = useSearchParamsSetter()
  const isMobile = useIsMobile()

  const viewOptions = [
    {
      view: "day" as const,
      icon: ListIcon,
      label: t("calendar.header.viewDay"),
    },
    {
      view: "week" as const,
      icon: ColumnsIcon,
      label: t("calendar.header.viewWeek"),
    },
    {
      view: "month" as const,
      icon: GridFourIcon,
      label: t("calendar.header.viewMonth"),
    },
    {
      view: "year" as const,
      icon: GridNineIcon,
      label: t("calendar.header.viewYear"),
    },
    {
      view: "agenda" as const,
      icon: CalendarDotIcon,
      label: t("calendar.header.viewAgenda"),
    },
  ]
  const activeOption =
    viewOptions.find((option) => option.view === view) ?? viewOptions[0]!

  return (
    <div className="flex flex-col gap-4 border-b p-4 @lg:flex-row @lg:items-center @lg:justify-between">
      <div className="flex items-center gap-3">
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 @sm:flex-row @sm:justify-between">
        <div className="stack-row gap-2">
          {isMobile ? (
            // A 5-icon row is cramped as a touch target and unlabeled — a
            // bottom Sheet gives each view a full-width, labeled row instead.
            <DataSheet
              title={t("calendar.header.changeView")}
              side="bottom"
              trigger={
                <Button variant="outline" className="justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <activeOption.icon strokeWidth={1.8} />
                    {activeOption.label}
                  </span>
                  <CaretDownIcon />
                </Button>
              }
            >
              <div className="flex flex-col gap-1 p-6 pt-0">
                {viewOptions.map((option) => (
                  <SheetClose asChild key={option.view}>
                    <Button
                      variant={view === option.view ? "default" : "ghost"}
                      className="w-full justify-start gap-2"
                      onClick={() => setSearchParams({ view: option.view })}
                    >
                      <option.icon strokeWidth={1.8} />
                      {option.label}
                    </Button>
                  </SheetClose>
                ))}
              </div>
            </DataSheet>
          ) : (
            <ButtonGroup>
              {viewOptions.map((option) => (
                <Button
                  key={option.view}
                  aria-label={option.label}
                  size="icon"
                  variant={view === option.view ? "default" : "outline"}
                  onClick={() => setSearchParams({ view: option.view })}
                >
                  <option.icon strokeWidth={1.8} />
                </Button>
              ))}
            </ButtonGroup>
          )}

          {isMobile ? (
            <DataSheet
              title={t("calendar.header.settingsAria")}
              side="bottom"
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("calendar.header.settingsAria")}
                >
                  <GearIcon />
                </Button>
              }
            >
              <div className="space-y-4 p-6 pt-0">
                <ChangeBadgeVariantInput />
                <ChangeWorkingHoursInput />
                <ChangeVisibleHoursInput />
              </div>
            </DataSheet>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("calendar.header.settingsAria")}
                >
                  <GearIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto space-y-4">
                <ChangeBadgeVariantInput />
                <ChangeWorkingHoursInput />
                <ChangeVisibleHoursInput />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <AddEventDialog>
          <Button className="w-full @sm:w-auto">
            <PlusIcon />
            {t("calendar.header.addEvent")}
          </Button>
        </AddEventDialog>
      </div>
    </div>
  )
}
