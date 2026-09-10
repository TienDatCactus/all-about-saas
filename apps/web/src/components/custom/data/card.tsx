import type React from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DataCardProp extends Omit<
  React.ComponentProps<typeof Card>,
  "title" | "children" | "content"
> {
  title: React.ReactNode
  description?: string | React.ReactNode
  action?: React.ReactNode
  content: React.ReactNode | string
}

/** Extra props (onClick, onKeyDown, role, tabIndex, style, ...) pass straight
 *  through to the underlying Card — e.g. to make it keyboard-activatable. */
export default function DataCard({
  title,
  description,
  action,
  className,
  content,
  ...rest
}: DataCardProp) {
  return (
    <Card className={cn(className)} {...rest}>
      <CardHeader>
        <CardTitle className="truncate">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
