import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import * as React from "react"

interface UsePaginationOptions {
  total?: number
  pageSize?: number
  initialPage?: number
}

/**
 * Page state for a list. Deliberately controlled-friendly: everything is
 * derived, so the current page can never point past the end of the data.
 */
interface UsePaginationOptions {
  total?: number
  pageSize?: number
  initialPage?: number
}

export function usePagination({
  total = 0,
  pageSize: initialPageSize = 12,
  initialPage = 1,
}: UsePaginationOptions) {
  const [page, setPage] = React.useState(initialPage)
  const [pageSize, setRawPageSize] = React.useState(initialPageSize)

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const safePage = Math.min(page, pageCount)

  React.useEffect(() => {
    if (page !== safePage) {
      setPage(safePage)
    }
  }, [page, safePage])

  const setPageSize = React.useCallback((size: number) => {
    setRawPageSize(size)
    setPage(1)
  }, [])

  const query = React.useMemo(
    () => ({
      page: safePage,
      limit: pageSize,
    }),
    [safePage, pageSize]
  )

  const slice = React.useCallback(
    <T,>(items: T[]) =>
      items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [safePage, pageSize]
  )

  return {
    page: safePage,
    pageCount,
    pageSize,
    total,
    setPage,
    setPageSize,
    query,
    slice,
  }
}
export type PaginationState = ReturnType<typeof usePagination>

/**
 * Page numbers to render, with `null` marking an ellipsis gap.
 * Width is constant so the control never reflows as you page through.
 */
function pageWindow(
  page: number,
  pageCount: number,
  siblings: number
): (number | null)[] {
  // first + last + current + 2 ellipses + siblings on both sides
  const slots = siblings * 2 + 5
  if (pageCount <= slots) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const left = Math.max(page - siblings, 1)
  const right = Math.min(page + siblings, pageCount)
  const showLeftGap = left > 2
  const showRightGap = right < pageCount - 1

  if (!showLeftGap && showRightGap) {
    const count = siblings * 2 + 3
    return [...Array.from({ length: count }, (_, i) => i + 1), null, pageCount]
  }

  if (showLeftGap && !showRightGap) {
    const count = siblings * 2 + 3
    return [
      1,
      null,
      ...Array.from({ length: count }, (_, i) => pageCount - count + 1 + i),
    ]
  }

  return [
    1,
    null,
    ...Array.from({ length: right - left + 1 }, (_, i) => left + i),
    null,
    pageCount,
  ]
}

interface DataPaginationProps extends Pick<
  PaginationState,
  "page" | "pageSize" | "setPage" | "setPageSize"
> {
  total: number
  siblings?: number
  /** Renders a rows-per-page select when provided. */
  pageSizeOptions?: number[]
  /** Hides the "N–M of T" summary. */
  hideSummary?: boolean
  className?: string
}
/*
Drop under any list — spread the hook straight in:

    const pagination = usePagination({ total: sessions.length })
    ...
    {pagination.slice(sessions).map(...)}
    <DataPagination {...pagination} pageSizeOptions={[12, 24, 48]} />
*/

export default function DataPagination({
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
  siblings = 1,
  pageSizeOptions = [12, 24, 48],
  hideSummary,
  className,
}: DataPaginationProps) {
  // Nothing to page through and no page-size choice to offer.
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const pages = pageWindow(page, pageCount, siblings)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        "flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between",
        className
      )}
    >
      {!hideSummary && (
        <p
          className="text-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {total === 0 ? "No results" : `${first}–${last} of ${total}`}
        </p>
      )}

      <div className="flex items-center gap-4">
        {pageSizeOptions && (
          <div className="flex items-center gap-2">
            <span
              id="rows-per-page-label"
              className="hidden text-sm text-muted-foreground sm:block"
            >
              Rows
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger
                size="sm"
                className="w-[4.5rem]"
                aria-labelledby="rows-per-page-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        {pageCount > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              {/* Buttons, not the anchor-based PaginationLink: these mutate
                  state rather than navigate, and an <a> cannot be disabled. */}
              <PaginationItem>
                <Button
                  variant="ghost"
                  aria-label="Go to previous page"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <CaretLeftIcon data-icon="inline-start" />
                  <span className="hidden sm:block">Previous</span>
                </Button>
              </PaginationItem>

              {pages.map((p, i) =>
                p === null ? (
                  <PaginationItem key={`gap-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <Button
                      variant={p === page ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Go to page ${p}`}
                      aria-current={p === page ? "page" : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <Button
                  variant="ghost"
                  aria-label="Go to next page"
                  disabled={page >= pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  <span className="hidden sm:block">Next</span>
                  <CaretRightIcon data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}
