import { useRouter } from "@tanstack/react-router"
import React, { useMemo } from "react"
import { DataDropdown } from "../data/dropdown"
import { PathIcon } from "@phosphor-icons/react"
interface RouteDropdownProps {
  hiddenRoutes?: Array<string>
}
export const DEFAULT_HIDDEN_ROUTES = [
  "/verify-email",
  "/badminton/s",
  "/auth/*",
]

function routeTitle(path: string) {
  const segment = path.split("/").filter(Boolean).pop()
  if (!segment) return "Home"
  if (segment.startsWith("$")) return segment.slice(1)
  const words = segment.replace(/-/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const RouteDropdown: React.FC<RouteDropdownProps> = ({
  hiddenRoutes = DEFAULT_HIDDEN_ROUTES,
}) => {
  const router = useRouter()

  // Absolute paths navigate() accepts — routesByPath keys index routes with a
  // trailing slash ("/badminton/") that `to` rejects, so keys are normalized
  // into this union below.
  type RoutePath = Extract<
    Parameters<typeof router.navigate>[0]["to"],
    `/${string}`
  >
  interface RouteNode {
    path: RoutePath
    /** Present → the node renders as a submenu of its section's routes. */
    children?: Array<RouteNode>
  }

  const routeTree = useMemo<Array<RouteNode>>(() => {
    const isHidden = (path: string) =>
      hiddenRoutes.some(
        (hidden) =>
          path === hidden ||
          path.startsWith(`${hidden}/`) ||
          path.includes("auth") ||
          path.includes("$")
      )
    const paths = (
      [
        ...new Set(
          Object.keys(router.routesByPath).map((path) =>
            path.length > 1 ? path.replace(/\/$/, "") : path
          )
        ),
      ] as Array<RoutePath>
    ).filter((path) => !isHidden(path))
    // First segment of each path ("/badminton/new" → "badminton"). A segment
    // only becomes a submenu when several routes share it — otherwise one-off
    // pages like /verify-email would each get a one-row flyout.
    const firstSegment = (path: string) => path.split("/").filter(Boolean)[0]
    const segmentCounts = new Map<string, number>()
    for (const path of paths) {
      const segment = firstSegment(path)
      if (segment)
        segmentCounts.set(segment, (segmentCounts.get(segment) ?? 0) + 1)
    }

    const roots: Array<RouteNode> = []
    const bySegment = new Map<string, Array<RoutePath>>()
    for (const path of paths) {
      const segment = firstSegment(path)
      if (segment && (segmentCounts.get(segment) ?? 0) > 1) {
        bySegment.set(segment, [...(bySegment.get(segment) ?? []), path])
      } else {
        roots.push({ path })
      }
    }

    // String() detour: `to` comes off a generic signature, and in this file
    // TS collapses the extracted union to `never`, which has no methods.
    const byPath = (a: RouteNode, b: RouteNode) =>
      String(a.path).localeCompare(String(b.path))
    const submenus = [...bySegment.entries()].map(
      ([segment, children]): RouteNode => ({
        // Display/key only: the sub-trigger opens the flyout, it never
        // navigates — the section's index route sits inside as a child.
        path: `/${segment}` as RoutePath,
        children: children.map((path) => ({ path })).sort(byPath),
      })
    )
    return [...roots.sort(byPath), ...submenus.sort(byPath)]
  }, [router.routesByPath, hiddenRoutes])

  return (
    <DataDropdown
      items={routeTree}
      getKey={(node) => node.path}
      getChildren={(node) => node.children}
      getTitle={(node) => routeTitle(node.path)}
      getDescription={(node) => (node.children ? undefined : node.path)}
      getMedia={() => <PathIcon />}
      mediaVariant="icon"
      label="Pages"
      align="start"
      contentClassName="w-64"
      onSelect={(node) => void router.navigate({ to: node.path })}
    />
  )
}

export default RouteDropdown
