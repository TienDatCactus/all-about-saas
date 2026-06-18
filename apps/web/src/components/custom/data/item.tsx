import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import type React from "react";
type Media =
  | {
      variant: "icon";
      icon: React.ReactNode;
    }
  | {
      variant: "image";
      image: React.ReactNode;
    };

interface DataItemProp {
  media?: Media;
  header?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}
/*
For lists, use with:
    <ItemGroup>
        <DataItem />
        <ItemSeparator />
        <DataItem />
    </ItemGroup>
*/

export default function DataItem({
  media,
  title,
  description,
  action,
  header,
  className,
}: DataItemProp) {
  return (
    <Item className={cn(className)}>
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
  );
}
