import { Fragment } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import type { ReactNode } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/** Context handed to a function-form crumb so dynamic segments can build a label. */
export interface CrumbContext {
  params: Record<string, string>
  loaderData: unknown
  /** Resolved, real pathname of this match (params already substituted). */
  pathname: string
}

/**
 * A route's breadcrumb label. Either a static node, or a function of the match
 * (use the function form for dynamic segments, e.g. `(c) => c.params.sessionId`).
 * Return `null`/`undefined` from the function to skip the route entirely.
 */
export type Crumb = ReactNode | ((ctx: CrumbContext) => ReactNode)

// Make `staticData.crumb` type-safe on every `createFileRoute(...)` / `createRootRoute(...)`.
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * Label for this route in the breadcrumb trail. Omit to hide the route
     * from the trail (useful for pathless/layout routes).
     */
    crumb?: Crumb
  }
}

interface ResolvedCrumb {
  label: ReactNode
  /** Real pathname to link to; the last crumb is rendered as plain text. */
  pathname: string
}

export interface BreadcrumbsProps {
  className?: string
  /**
   * Manual override. When provided, the trail is rendered from these items
   * instead of the route tree — for the rare page that needs a bespoke trail.
   */
  items?: Array<{ label: ReactNode; to?: string }>
  /** Custom separator between crumbs. Defaults to the primitive's caret. */
  separator?: ReactNode
}

/**
 * App-wide breadcrumbs, driven by the router.
 *
 * Zero-config: drop `<Breadcrumbs />` into a layout/header and give each route a
 * label via `staticData`:
 *
 * ```ts
 * export const Route = createFileRoute("/badminton")({
 *   staticData: { crumb: "Badminton" },
 * });
 *
 * export const Route = createFileRoute("/badminton/$sessionId")({
 *   staticData: { crumb: (c) => `Session ${c.params.sessionId.slice(0, 8)}` },
 * });
 * ```
 *
 * Routes without a `crumb` are skipped, so pathless/layout routes disappear
 * cleanly. The deepest crumb renders as the current page (not a link).
 */
export function Breadcrumbs({ className, items, separator }: BreadcrumbsProps) {
  const routeCrumbs = useRouterState({
    select: (state): Array<ResolvedCrumb> =>
      state.matches.flatMap((match) => {
        const crumb = match.staticData.crumb
        if (crumb == null) return []
        const label =
          typeof crumb === "function"
            ? crumb({
                params: match.params,
                loaderData: match.loaderData,
                pathname: match.pathname,
              })
            : crumb
        if (label == null) return []
        return [{ label, pathname: match.pathname }]
      }),
  })

  const crumbs: Array<ResolvedCrumb> = items
    ? items.map((item) => ({ label: item.label, pathname: item.to ?? "" }))
    : routeCrumbs

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          const linkable = !isLast && crumb.pathname !== ""
          return (
            <Fragment key={`${crumb.pathname}-${i}`}>
              <BreadcrumbItem>
                {linkable ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.pathname}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {isLast ? null : (
                <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
              )}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
