import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSearchParamsSetter } from "@/hooks/use-search-params-setter";
import type { IEvent } from "../../interfaces";
import type { TCalendarView } from "../../types";
import { TodayButton } from "./today-button";
import { DateNavigator } from "./date-navigator";
import {
  CalendarDotIcon,
  ColumnsIcon,
  GearIcon,
  GridFourIcon,
  GridNineIcon,
  ListIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { AddEventDialog } from "../dialogs/add-event-dialog";
import { ChangeBadgeVariantInput } from "../change-badge-variant-input";
import { ChangeWorkingHoursInput } from "../change-working-hours-input";
import { ChangeVisibleHoursInput } from "../change-visible-hours-input";

interface IProps {
  view: TCalendarView;
  events: IEvent[];
}

export function CalendarHeader({ view, events }: IProps) {
  const setSearchParams = useSearchParamsSetter();

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex first:rounded-r-none last:rounded-l-none [&:not(:first-child):not(:last-child)]:rounded-none">
            <Button
              aria-label="View by day"
              size="icon"
              variant={view === "day" ? "default" : "outline"}
              className="rounded-r-none [&_svg]:size-5"
              onClick={() => setSearchParams({ view: "day" })}
            >
              <ListIcon strokeWidth={1.8} />
            </Button>

            <Button
              aria-label="View by week"
              size="icon"
              variant={view === "week" ? "default" : "outline"}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setSearchParams({ view: "week" })}
            >
              <ColumnsIcon strokeWidth={1.8} />
            </Button>

            <Button
              aria-label="View by month"
              size="icon"
              variant={view === "month" ? "default" : "outline"}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setSearchParams({ view: "month" })}
            >
              <GridFourIcon strokeWidth={1.8} />
            </Button>

            <Button
              aria-label="View by year"
              size="icon"
              variant={view === "year" ? "default" : "outline"}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setSearchParams({ view: "year" })}
            >
              <GridNineIcon strokeWidth={1.8} />
            </Button>

            <Button
              aria-label="View by agenda"
              size="icon"
              variant={view === "agenda" ? "default" : "outline"}
              className="-ml-px rounded-l-none [&_svg]:size-5"
              onClick={() => setSearchParams({ view: "agenda" })}
            >
              <CalendarDotIcon strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Cài đặt lịch">
              <GearIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto space-y-4">
            <ChangeBadgeVariantInput />
            <ChangeWorkingHoursInput />
            <ChangeVisibleHoursInput />
          </PopoverContent>
        </Popover>

        <AddEventDialog>
          <Button className="w-full sm:w-auto">
            <PlusIcon />
            Thêm buổi dạy
          </Button>
        </AddEventDialog>
      </div>
    </div>
  );
}
