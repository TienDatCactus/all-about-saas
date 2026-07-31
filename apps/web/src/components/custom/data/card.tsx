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

interface DataCardProp {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  content: React.ReactNode | string
}

export default function DataCard({
  title,
  description,
  action,
  className,
  content,
}: DataCardProp) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="truncate">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
