import { AddonInput as Input } from "@/components/custom/addon-input"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

interface HoursStepperInputProps {
  id: string
  value: number
  onChange: (value: number) => void
  onBlur?: () => void
  isInvalid?: boolean
}

export function HoursStepperInput({
  id,
  value,
  onChange,
  onBlur,
  isInvalid,
}: HoursStepperInputProps) {
  const step = (delta: number) =>
    onChange(Math.max(0, Number((value + delta).toFixed(1))))

  return (
    <ButtonGroup>
      <Button
        type="button"
        variant="outline"
        onClick={(e) => {
          e.preventDefault()
          step(-0.1)
        }}
      >
        -
      </Button>
      <Input
        id={id}
        type="number"
        step={0.1}
        min={0}
        inputMode="decimal"
        endAddon="h"
        aria-invalid={isInvalid}
        className="w-16 text-right tabular-nums lg:w-full"
        value={value}
        onBlur={onBlur}
        onChange={(e) => {
          let n = e.target.valueAsNumber
          if (Number.isNaN(n)) n = 0
          onChange(Math.max(0, n))
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={(e) => {
          e.preventDefault()
          step(0.1)
        }}
      >
        +
      </Button>
    </ButtonGroup>
  )
}
