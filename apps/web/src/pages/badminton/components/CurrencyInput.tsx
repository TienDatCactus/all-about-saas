import * as React from "react"
import { NumericFormat } from "react-number-format"
import { AddonInput as Input } from "@/components/custom/addon-input"

interface CurrencyInputProps {
  id?: string
  "aria-label"?: string
  value: number
  onChange: (value: number) => void
  startAddon?: React.ReactNode
  endAddon?: React.ReactNode
  className?: string
}

export function CurrencyInput({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  startAddon,
  endAddon,
  className,
}: CurrencyInputProps) {
  return (
    <NumericFormat
      id={id}
      aria-label={ariaLabel}
      customInput={Input}
      startAddon={startAddon}
      endAddon={endAddon}
      className={className}
      inputMode="numeric"
      placeholder="0"
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      allowNegative={false}
      value={value ? value : ""}
      onValueChange={(values) => onChange(values.floatValue ?? 0)}
    />
  )
}
