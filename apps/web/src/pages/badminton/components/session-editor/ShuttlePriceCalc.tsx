import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CalculatorIcon } from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatVnd, parseVnd } from "@/pages/badminton/lib/format"

interface ShuttlePriceCalcProps {
  /** Called with the derived per-shuttle price when the user applies it. */
  onApply: (unitPrice: number) => void
}

/**
 * Shuttles are usually bought by the tube, not individually. This derives the
 * per-shuttle price from what's actually on the receipt: total tube price and
 * how many shuttles were in it.
 */
export function ShuttlePriceCalc({ onApply }: ShuttlePriceCalcProps) {
  const [tubePrice, setTubePrice] = useState(0)
  const [shuttlesPerTube, setShuttlesPerTube] = useState(0)
  const unitPrice = shuttlesPerTube > 0 ? tubePrice / shuttlesPerTube : 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={"outline"} size={"icon-sm"} type="button">
          <CalculatorIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="leading-none font-medium">Shuttle price</h4>
            <p className="text-sm text-muted-foreground">
              Derive the per-shuttle price from a tube's total price.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="tubePrice">Tube price</Label>
              <Input
                id="tubePrice"
                inputMode="numeric"
                className="col-span-2 h-8 text-right tabular-nums"
                placeholder="0"
                value={tubePrice ? formatVnd(tubePrice) : ""}
                onChange={(e) => setTubePrice(parseVnd(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="shuttlesPerTube">Shuttles / tube</Label>
              <Input
                id="shuttlesPerTube"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="col-span-2 h-8 text-right tabular-nums"
                placeholder="0"
                value={shuttlesPerTube || ""}
                onChange={(e) =>
                  setShuttlesPerTube(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Per shuttle:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatVnd(unitPrice)} ₫
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              disabled={unitPrice <= 0}
              onClick={() => onApply(Math.round(unitPrice))}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
