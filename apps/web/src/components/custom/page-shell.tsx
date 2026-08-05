import {
  CaretDownIcon,
  DesktopTowerIcon,
  PathIcon,
} from "@phosphor-icons/react";
import { useMemo, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Breadcrumbs } from "./breadcrumb";
import { useRouter } from "@tanstack/react-router";
import { DataDropdown, type DataDropdownGroup } from "./data-dropdown";

/** "/auth/sign-up" → "Sign up", "/badminton/$sessionId" → "sessionId", "/" → "Home". */
function routeTitle(path: string) {
  const segment = path.split("/").filter(Boolean).pop();
  if (!segment) return "Home";
  if (segment.startsWith("$")) return segment.slice(1);
  const words = segment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Routes the header switcher hides by default: flows reached via an emailed
 * link or share token, never by browsing. An entry hides the path itself and
 * everything nested under it. Override per shell via `hiddenRoutes`.
 */
export const DEFAULT_HIDDEN_ROUTES = [
  "/verify-email",
  "/badminton/s",
  "/auth/*",
];

export function PageShell({
  children,
  hiddenRoutes = DEFAULT_HIDDEN_ROUTES,
}: {
  children: ReactNode;
  /** Paths (and their subtrees) to leave out of the route switcher. */
  hiddenRoutes?: string[];
}) {
  const router = useRouter();

  // Absolute paths navigate() accepts — routesByPath keys index routes with a
  // trailing slash ("/badminton/") that `to` rejects, so keys are normalized
  // into this union below.
  type RoutePath = Extract<
    Parameters<typeof router.navigate>[0]["to"],
    `/${string}`
  >;
  const routeGroups = useMemo<DataDropdownGroup<RoutePath>[]>(() => {
    const isHidden = (path: string) =>
      hiddenRoutes.some(
        (hidden) =>
          path === hidden ||
          path.startsWith(`${hidden}/`) ||
          path.includes("auth"),
      );
    const paths = (
      [
        ...new Set(
          Object.keys(router.routesByPath).map((path) =>
            path.length > 1 ? path.replace(/\/$/, "") : path,
          ),
        ),
      ] as RoutePath[]
    ).filter((path) => !isHidden(path));
    // First segment of each path ("/auth/login" → "auth"). A segment only
    // becomes a group of its own when several routes share it — otherwise
    // one-off pages like /verify-email would each get a one-row section.
    const firstSegment = (path: string) => path.split("/").filter(Boolean)[0];
    const segmentCounts = new Map<string, number>();
    for (const path of paths) {
      const segment = firstSegment(path);
      if (segment)
        segmentCounts.set(segment, (segmentCounts.get(segment) ?? 0) + 1);
    }

    const byParent = new Map<string, RoutePath[]>();
    for (const path of paths) {
      const segment = firstSegment(path);
      const parent =
        segment && (segmentCounts.get(segment) ?? 0) > 1 ? `/${segment}` : "/";
      byParent.set(parent, [...(byParent.get(parent) ?? []), path]);
    }

    return [...byParent.entries()]
      .sort(([a], [b]) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))
      .map(([parent, items]) => ({
        key: parent,
        label: parent === "/" ? "Pages" : routeTitle(parent),
        items: items.sort(),
      }));
  }, [router.routesByPath, hiddenRoutes]);

  return (
    <main className="@container flex min-h-screen w-full items-start justify-center">
      <div className="flex w-full flex-col">
        <header className="border-border bg-background sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="ghost" className="font-semibold">
              <DesktopTowerIcon />
              All about Saas
            </Button>
            <DataDropdown
              groups={routeGroups}
              getKey={(path) => path}
              getTitle={routeTitle}
              getDescription={(path) => path}
              getMedia={() => <PathIcon />}
              mediaVariant="icon"
              // Param routes need a concrete id/token to be a destination.
              isDisabled={(path) => path.includes("$")}
              label="Pages"
              align="start"
              contentClassName="w-64"
              onSelect={(path) => void router.navigate({ to: path })}
            />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </div>
    </main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <Popover>
          <div className="flex items-center">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <PopoverTrigger asChild>
              <Button variant={"ghost"} size={"icon"}>
                <CaretDownIcon />
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent className="w-fit">
            <Breadcrumbs />
          </PopoverContent>
        </Popover>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
