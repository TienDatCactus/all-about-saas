// hover-card.tsx
import * as React from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../ui/hover-card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "../../ui/item"
import { cn } from "@/lib/utils"

export interface DataHoverCardProps<T> {
  /** The data the card describes. `items` renders one row each. */
  item?: T
  items?: Array<T>
  /**
   * Ready-made card content — the escape hatch when the card shows a
   * composed node rather than data rows. Wins over `item`/`items`.
   */
  content?: React.ReactNode
  /** Stable key per row; falls back to the array index. */
  getKey?: (item: T, index: number) => React.Key
  /** Full control over a row — wins over the field getters below. */
  renderItem?: (item: T, index: number) => React.ReactNode
  /** Default row: title + optional description + optional leading media. */
  getTitle?: (item: T) => React.ReactNode
  getDescription?: (item: T) => React.ReactNode
  /** Leading visual — an <Avatar>, an icon… Rendered inside ItemMedia. */
  getMedia?: (item: T) => React.ReactNode
  /** ItemMedia variant: "icon" for svg icons, "image" for avatars/photos. */
  mediaVariant?: React.ComponentProps<typeof ItemMedia>["variant"]
  /** The element the card attaches to (rendered via Radix `asChild`). */
  children: React.ReactElement
  side?: React.ComponentProps<typeof HoverCardContent>["side"]
  align?: React.ComponentProps<typeof HoverCardContent>["align"]
  /** Hover intent delays in ms (Radix defaults: 700 open / 300 close). */
  openDelay?: number
  closeDelay?: number
  contentClassName?: string
}

/**
 * Hover card over a piece (or list) of data — the roomier sibling of
 * DataTooltip, same getter API as DataDropdown / DataAvatar. Unlike the
 * tooltip's inverted bubble this surface is a regular popover, so rows use
 * the full Item layout (media + title + description). With no item and no
 * content the trigger renders bare.
 */
export function DataHoverCard<T>({
  item,
  items: itemsProp,
  content,
  getKey,
  renderItem,
  getTitle,
  getDescription,
  getMedia,
  mediaVariant = "default",
  children,
  side,
  align,
  openDelay,
  closeDelay,
  contentClassName,
}: DataHoverCardProps<T>) {
  const items = itemsProp ?? (item !== undefined ? [item] : [])

  if (content == null && items.length === 0) {
    return children
  }

  const renderRow = (rowItem: T, index: number) => {
    const key = getKey ? getKey(rowItem, index) : index
    if (renderItem) {
      return (
        <React.Fragment key={key}>{renderItem(rowItem, index)}</React.Fragment>
      )
    }
    const title = getTitle ? getTitle(rowItem) : String(rowItem)
    const description = getDescription?.(rowItem)
    const media = getMedia?.(rowItem)
    return (
      <Item key={key} size="sm" className="p-0">
        {media != null && <ItemMedia variant={mediaVariant}>{media}</ItemMedia>}
        <ItemContent className="gap-0.5">
          <ItemTitle>{title}</ItemTitle>
          {description != null && (
            <ItemDescription>{description}</ItemDescription>
          )}
        </ItemContent>
      </Item>
    )
  }

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className={cn(
          items.length > 1 && "flex flex-col gap-3",
          contentClassName
        )}
      >
        {content ?? items.map(renderRow)}
      </HoverCardContent>
    </HoverCard>
  )
}
