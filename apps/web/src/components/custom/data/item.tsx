import type React from "react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { cn } from "@/lib/utils"

type Media =
  | {
      variant: "icon"
      icon: React.ReactNode
    }
  | {
      variant: "image"
      image: React.ReactNode
    }

interface DataItemProp extends Omit<
  React.ComponentProps<typeof Item>,
  "title" | "children" | "variant"
> {
  media?: Media
  header?: React.ReactNode
  title: React.ReactNode
  description?: string
  action?: React.ReactNode
  variant?: "default" | "muted" | "outline"
  size?: "default" | "sm" | "xs"
}
/*
For lists, use with:
    <ItemGroup>
        <DataItem />
        <ItemSeparator />
        <DataItem />
    </ItemGroup>

Extra props (onClick, onKeyDown, role, tabIndex, style, ...) pass straight
through to the underlying Item — e.g. to make a row keyboard-activatable.
*/

export default function DataItem({
  media,
  title,
  description,
  action,
  header,
  className,
  variant,
  size,
  ...rest
}: DataItemProp) {
  return (
    <Item className={cn(className)} variant={variant} size={size} {...rest}>
      {header && <ItemHeader>{header}</ItemHeader>}
      {media && (
        <ItemMedia variant={media.variant}>
          {media.variant === "icon" ? media.icon : media.image}
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
      </ItemContent>
      {action && <ItemActions>{action}</ItemActions>}
    </Item>
  )
}
