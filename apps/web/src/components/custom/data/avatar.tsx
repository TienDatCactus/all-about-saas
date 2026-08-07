// data-avatar.tsx
import * as React from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "../../ui/avatar"
import { cn } from "@/lib/utils"

/** "Nguyen Tien Dat" → "ND", "shadcn" → "S". */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.charAt(0) ?? ""
  const last =
    words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

export interface DataAvatarProps<T> {
  /** One item renders a single Avatar; several render an overlapping group. */
  items?: Array<T>
  /**
   * Single-avatar convenience: `item={user}` instead of `items={[user]}`.
   * Ignored when `items` is given. With neither (e.g. auth still loading),
   * a lone "?" fallback avatar is rendered.
   */
  item?: T
  /** Stable key per avatar; falls back to the array index. */
  getKey?: (item: T, index: number) => React.Key
  /** Image URL. Missing/broken images fall back to initials from `getName`. */
  getImage?: (item: T) => string | undefined
  /** Display name: initials fallback, img alt and hover tooltip. */
  getName?: (item: T) => string
  /**
   * Extra node rendered inside the avatar — return an <AvatarBadge> for a
   * status dot (its color is yours to set: `className="bg-emerald-500"`).
   */
  getBadge?: (item: T) => React.ReactNode
  size?: React.ComponentProps<typeof Avatar>["size"]
  /** Collapse avatars beyond this many into a trailing "+N" count. */
  max?: number
  className?: string
}

/**
 * Avatar(s) driven by a list of data, sharing the getter API of DataDropdown.
 * Composes ui/avatar: a lone item is a plain Avatar, several become an
 * AvatarGroup, and anything past `max` collapses into an AvatarGroupCount.
 */
export function DataAvatar<T>({
  items: itemsProp,
  item,
  getKey,
  getImage,
  getName,
  getBadge,
  size = "default",
  max,
  className,
}: DataAvatarProps<T>) {
  const items = itemsProp ?? (item !== undefined ? [item] : [])
  const visible = max != null && max >= 0 ? items.slice(0, max) : items
  const overflow = items.length - visible.length

  const renderAvatar = (item: T, index: number) => {
    const name = getName?.(item)
    const image = getImage?.(item)
    return (
      <Avatar
        key={getKey ? getKey(item, index) : index}
        size={size}
        title={name}
        className={items.length === 1 ? className : undefined}
      >
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback>{name ? initialsOf(name) : "?"}</AvatarFallback>
        {getBadge?.(item)}
      </Avatar>
    )
  }

  if (items.length === 0) {
    return (
      <Avatar size={size} className={className}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    )
  }

  const [only] = items
  if (items.length === 1 && only !== undefined) {
    return renderAvatar(only, 0)
  }

  return (
    <AvatarGroup className={cn(className)}>
      {visible.map(renderAvatar)}
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
