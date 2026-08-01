import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import * as React from "react"
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

const DEFAULT_PAGE_SIZE = 12

interface UsePaginationOptions {
  pageSize?: number
  initialPage?: number
}

/**
 * Page state only — deliberately NOT the row count.
 *
 * Server-side the total arrives in the response, which is fetched *using* this
 * state, so the hook cannot receive it without a circular dependency: the
 * query needs `query`, and `total` needs the query. Holding a copy here just
 * pins it at 0 on every render, which caps pageCount at 1 and freezes the
 * control on page 1. Pass the total to <DataPagination /> instead — it owns
 * the page-count maths, where the real number is actually available.
 */
export function usePagination({
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  initialPage = 1,
}: UsePaginationOptions = {}) {
  const [page, setRawPage] = React.useState(initialPage)
  const [pageSize, setRawPageSize] = React.useState(initialPageSize)

  const setPage = React.useCallback((next: number) => {
    setRawPage(Math.max(1, next))
  }, [])

  const setPageSize = React.useCallback((size: number) => {
    setRawPageSize(size)
    setRawPage(1)
  }, [])

  /** Server-side paging: spread straight into the list query's params. */
  const query = React.useMemo(
    () => ({ page, limit: pageSize }),
    [page, pageSize]
  )

  /** Client-side paging: the slice of `items` belonging to the current page. */
  const slice = React.useCallback(
    <T,>(items: Array<T>) =>
      items.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize]
  )

  return { page, pageSize, setPage, setPageSize, query, slice }
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
): Array<number | null> {
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
  /** Choices in the rows-per-page select. Defaults to [12, 24, 48]. */
  pageSizeOptions?: Array<number>
  /** Hides the "N–M of T" summary. */
  hideSummary?: boolean
  className?: string
}
/*
Drop under any list — spread the hook in and hand it the total.

Server-side:
    const pagination = usePagination()
    const query = useSessionsQuery(pagination.query)
    ...
    {data.data.map(...)}
    <DataPagination {...pagination} total={data.total} />

Client-side:
    const pagination = usePagination()
    {pagination.slice(items).map(...)}
    <DataPagination {...pagination} total={items.length} />
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  // Rows can vanish under the user — deleting the last row of the last page,
  // an undo window committing. Step back so the list never renders empty and
  // the server query stops asking for a page that no longer exists.
  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount, setPage])

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
