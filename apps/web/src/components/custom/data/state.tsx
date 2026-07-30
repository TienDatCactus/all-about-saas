import DataEmpty from "@/components/custom/data/empty"
import DataError from "@/components/custom/data/error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowClockwiseIcon } from "@phosphor-icons/react"
import { isValidElement } from "react"
import type React from "react"

type ErrorSlot = Partial<React.ComponentProps<typeof DataError>>
type EmptySlot = React.ComponentProps<typeof DataEmpty>

/** The slice of a TanStack UseQueryResult that DataState consumes. */
interface QueryLike<TData> {
  data: TData | undefined
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

export interface DataStateProps<TData> {
  query: QueryLike<TData>
  /** Shown while the query has no data yet. Defaults to a block skeleton. */
  loading?: React.ReactNode
  /**
   * Shown on failure (and when a settled query has no data). Pass a config for
   * DataError — its `content` defaults to a retry button wired to refetch();
   * pass `content: null` to suppress it — or a ReactNode to take over fully.
   */
  error?: React.ReactNode | ErrorSlot
  /**
   * Shown when data is empty. Pass a config for DataEmpty or a ReactNode.
   * Omit the prop entirely to render children even for empty data.
   */
  empty?: React.ReactNode | EmptySlot
  /** What counts as empty. Defaults to "data is an empty array". */
  isEmpty?: (data: TData) => boolean
  /** Rendered once data exists — receives it non-null and typed. */
  children: (data: TData) => React.ReactNode
}

/*
Collapses the pending → error → empty → data branching every query-backed page
repeats:

    <DataState
      query={useSessionsQuery()}
      loading={<ListSkeleton />}
      error={{ title: "Couldn't load your sessions" }}
      empty={{ title: "No sessions yet", content: <NewSessionButton /> }}
    >
      {(sessions) => <ul>...</ul>}
    </DataState>
*/

export default function DataState<TData>({
  query,
  loading,
  error,
  empty,
  isEmpty,
  children,
}: DataStateProps<TData>) {
  const { data, isPending, isError, refetch } = query

  if (isPending) {
    return <>{loading ?? <Skeleton className="h-64 w-full rounded-xl" />}</>
  }

  if (isError || data === undefined) {
    if (isValidElement(error)) return error
    const config = (error as ErrorSlot | undefined) ?? {}
    return (
      <DataError
        title={config.title ?? "Something went wrong"}
        description={
          config.description ?? "The data couldn't be loaded. Please try again."
        }
        media={config.media}
        className={config.className}
        content={
          config.content === undefined ? (
            <Button variant="outline" onClick={() => refetch()}>
              <ArrowClockwiseIcon data-icon="inline-start" />
              Try again
            </Button>
          ) : (
            config.content
          )
        }
      />
    )
  }

  const emptyByDefault = Array.isArray(data) && data.length === 0
  if (empty !== undefined && (isEmpty ? isEmpty(data) : emptyByDefault)) {
    return isValidElement(empty) ? (
      empty
    ) : (
      <DataEmpty {...(empty as EmptySlot)} />
    )
  }

  return <>{children(data)}</>
}
