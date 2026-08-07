// data-dropdown.tsx
import { CaretDownIcon } from "@phosphor-icons/react"
import * as React from "react"
import { Button } from "../../ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "../../ui/item"
import { cn } from "@/lib/utils"

export interface DataDropdownGroup<T> {
  key?: React.Key
  /** Section heading, rendered as a DropdownMenuLabel. */
  label?: React.ReactNode
  items: Array<T>
}

export interface DataDropdownProps<T> {
  /** Flat list of rows. For labeled sections use `groups` instead. */
  items?: Array<T>
  /** Sections separated by DropdownMenuSeparator, each optionally labeled. */
  groups?: Array<DataDropdownGroup<T>>
  /**
   * Stable key per row; falls back to the array index. Required in practice
   * for `single`/`multiple` selection, where it is the row's value.
   */
  getKey?: (item: T, index: number) => React.Key
  /**
   * - `none` (default): plain action items.
   * - `single`: radio items — control with `value`/`onValueChange`.
   * - `multiple`: checkbox items — control with `values`/`onValuesChange`;
   *   the menu stays open while toggling.
   */
  selectionMode?: "none" | "single" | "multiple"
  /** Selected key in `single` mode. */
  value?: string
  onValueChange?: (value: string) => void
  /** Selected keys in `multiple` mode. */
  values?: Array<string>
  onValuesChange?: (values: Array<string>) => void
  /**
   * Full control over a row's content — wins over the field getters below.
   * The row is already wrapped in the appropriate menu item.
   */
  renderItem?: (item: T, index: number) => React.ReactNode
  /** Default row layout: title + optional description + optional media. */
  getTitle?: (item: T) => React.ReactNode
  getDescription?: (item: T) => React.ReactNode
  /**
   * Leading visual for the row — any React node: an <Avatar>, an icon, a
   * status dot… Rendered inside ItemMedia; return undefined to leave a
   * particular row without one.
   */
  getMedia?: (item: T) => React.ReactNode
  /**
   * ItemMedia variant for sizing: "icon" for svg icons, "image" for
   * avatars/photos, "default" otherwise.
   */
  mediaVariant?: React.ComponentProps<typeof ItemMedia>["variant"]
  /** Trailing hint (e.g. ⌘K), rendered as a DropdownMenuShortcut. */
  getShortcut?: (item: T) => React.ReactNode
  /** `destructive` styles the row as a dangerous action (`none` mode only). */
  getVariant?: (item: T) => "default" | "destructive"
  isDisabled?: (item: T) => boolean
  /**
   * Children of a row. A non-empty array turns the row into a submenu: same
   * row layout as the sub-trigger (plus the caret), children rendered in a
   * DropdownMenuSubContent through this same pipeline — so grandchildren
   * nest further, and selection modes / getters apply at every depth. The
   * sub-trigger itself only opens the flyout; it never fires onSelect.
   */
  getChildren?: (item: T) => Array<T> | undefined
  /**
   * Fires on activation in every selection mode. `index` is the item's
   * pre-order position across the whole tree (groups, then each item followed
   * by its children).
   */
  onSelect?: (item: T, index: number) => void
  /**
   * Custom trigger element. Rendered via Radix `asChild`, so it must accept a
   * forwarded ref and spread props (any ui/ component does).
   */
  trigger?: React.ReactElement
  /** Label for the default outline-button trigger. Ignored when `trigger` is set. */
  label?: React.ReactNode
  align?: React.ComponentProps<typeof DropdownMenuContent>["align"]
  contentClassName?: string
}

/**
 * Dropdown over an arbitrary list of data. Rows default to the Item layout
 * (media + title + description, where media is any node — avatar, icon…);
 * pass `renderItem` to replace a row wholesale or `trigger` to replace the
 * button. Supports labeled groups, radio / checkbox selection, and nested
 * submenus (`getChildren`) on top of plain action items.
 */
export function DataDropdown<T>({
  items,
  groups,
  getKey,
  selectionMode = "none",
  value,
  onValueChange,
  values = [],
  onValuesChange,
  renderItem,
  getTitle,
  getDescription,
  getMedia,
  mediaVariant = "default",
  getShortcut,
  getVariant,
  isDisabled,
  getChildren,
  onSelect,
  trigger,
  label = "Select",
  align = "end",
  contentClassName,
}: DataDropdownProps<T>) {
  const sections: Array<DataDropdownGroup<T>> = groups ?? [
    { items: items ?? [] },
  ]

  const renderDefaultRow = (item: T) => {
    const title = getTitle ? getTitle(item) : String(item)
    const description = getDescription?.(item)
    const media = getMedia?.(item)
    return (
      <Item size="xs" className="w-full p-2">
        {media != null && <ItemMedia variant={mediaVariant}>{media}</ItemMedia>}
        <ItemContent className="gap-0">
          <ItemTitle>{title}</ItemTitle>
          {description != null && (
            <ItemDescription className="leading-none">
              {description}
            </ItemDescription>
          )}
        </ItemContent>
      </Item>
    )
  }

  // Pre-order position across the whole tree, assigned as rows render. A
  // plain counter (reset every render) keeps `index` meaningful for flat
  // lists, groups and nested submenus alike.
  let cursor = 0

  const renderMenuItem = (item: T): React.ReactNode => {
    const index = cursor++
    const key = String(getKey ? getKey(item, index) : index)
    const disabled = isDisabled?.(item)
    const shortcut = getShortcut?.(item)
    const content = (
      <>
        {renderItem ? renderItem(item, index) : renderDefaultRow(item)}
        {shortcut != null && (
          <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
        )}
      </>
    )

    const children = getChildren?.(item)
    if (children && children.length > 0) {
      return (
        <DropdownMenuSub key={key}>
          {/* SubTrigger appends its own caret after the row content. */}
          <DropdownMenuSubTrigger disabled={disabled}>
            {content}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {children.map((child) => renderMenuItem(child))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    if (selectionMode === "single") {
      return (
        <DropdownMenuRadioItem
          key={key}
          value={key}
          disabled={disabled}
          onSelect={() => onSelect?.(item, index)}
        >
          {content}
        </DropdownMenuRadioItem>
      )
    }

    if (selectionMode === "multiple") {
      const checked = values.includes(key)
      return (
        <DropdownMenuCheckboxItem
          key={key}
          checked={checked}
          disabled={disabled}
          // Toggling one box rarely ends the interaction — keep the menu open
          // so the user can tick several without reopening it each time.
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(next) => {
            onValuesChange?.(
              next ? [...values, key] : values.filter((v) => v !== key)
            )
            onSelect?.(item, index)
          }}
        >
          {content}
        </DropdownMenuCheckboxItem>
      )
    }

    return (
      <DropdownMenuItem
        key={key}
        variant={getVariant?.(item)}
        disabled={disabled}
        onSelect={() => onSelect?.(item, index)}
      >
        {content}
      </DropdownMenuItem>
    )
  }

  const body = sections.map((group, groupIndex) => (
    <React.Fragment key={group.key ?? groupIndex}>
      {groupIndex > 0 && <DropdownMenuSeparator />}
      <DropdownMenuGroup>
        {group.label != null && (
          <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
        )}
        {group.items.map((item) => renderMenuItem(item))}
      </DropdownMenuGroup>
    </React.Fragment>
  ))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            {label}
            <CaretDownIcon />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn("w-48", contentClassName)}
        align={align}
      >
        {selectionMode === "single" ? (
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {body}
          </DropdownMenuRadioGroup>
        ) : (
          body
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
