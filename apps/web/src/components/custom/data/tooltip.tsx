// tooltip.tsx
import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { cn } from "@/lib/utils";

export interface DataTooltipProps<T> {
  /** The data the tooltip describes. `items` renders one row each. */
  item?: T;
  items?: Array<T>;
  /**
   * Ready-made bubble content — the escape hatch when the tooltip shows a
   * composed node (e.g. <Breadcrumbs />) rather than data rows. Wins over
   * `item`/`items` and the getters.
   */
  content?: React.ReactNode;
  /** Stable key per row; falls back to the array index. */
  getKey?: (item: T, index: number) => React.Key;
  /**
   * Full control over a row — wins over the field getters below. Note the
   * bubble is inverted (dark-on-light / light-on-dark), so content must read
   * on `bg-foreground`.
   */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** Default row: title + optional description + optional leading media. */
  getTitle?: (item: T) => React.ReactNode;
  getDescription?: (item: T) => React.ReactNode;
  /** Leading visual — an icon, a dot… Sized by the row, not the getter. */
  getMedia?: (item: T) => React.ReactNode;
  /** The element the tooltip attaches to (rendered via Radix `asChild`). */
  children: React.ReactElement;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  /** Per-tooltip hover delay in ms; the app provider's default is 0. */
  delayDuration?: number;
  contentClassName?: string;
}

/**
 * Tooltip over a piece (or list) of data, sharing the getter API of
 * DataDropdown / DataAvatar. With no item at all the trigger renders bare —
 * no empty bubble. Rows use tooltip-scale markup rather than <Item>: the
 * bubble inverts foreground/background, where Item's muted palette becomes
 * unreadable.
 */
export function DataTooltip<T>({
  item,
  items: itemsProp,
  content,
  getKey,
  renderItem,
  getTitle,
  getDescription,
  getMedia,
  children,
  side,
  align,
  delayDuration,
  contentClassName,
}: DataTooltipProps<T>) {
  const items = itemsProp ?? (item !== undefined ? [item] : []);

  if (content == null && items.length === 0) {
    return children;
  }

  const renderRow = (rowItem: T, index: number) => {
    const key = getKey ? getKey(rowItem, index) : index;
    if (renderItem) {
      return (
        <React.Fragment key={key}>{renderItem(rowItem, index)}</React.Fragment>
      );
    }
    const title = getTitle ? getTitle(rowItem) : String(rowItem);
    const description = getDescription?.(rowItem);
    const media = getMedia?.(rowItem);
    return (
      <div key={key} className="flex items-center gap-2">
        {media != null && (
          <span className="flex shrink-0 items-center [&_svg]:size-3.5">
            {media}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{title}</span>
          {description != null && (
            <span className="truncate opacity-70">{description}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className={cn(
          items.length > 1 && "flex-col items-start gap-1",
          contentClassName,
        )}
      >
        {content ?? items.map(renderRow)}
      </TooltipContent>
    </Tooltip>
  );
}
