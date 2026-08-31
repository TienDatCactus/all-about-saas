import * as React from "react"
import { AddonInput as Input } from "@/components/custom/addon-input"

interface CurrencyInputProps {
  id?: string
  "aria-label"?: string
  value: number
  onChange: (value: number) => void
  format: (value: number) => string
  parse: (input: string) => number
  startAddon?: React.ReactNode
  endAddon?: React.ReactNode
  className?: string
}

/** Finds the caret position in `text` that sits right after the `digitCount`-th
 *  digit character (skipping any separators along the way). Used to restore the
 *  caret after a formatted numeric string is re-rendered with new separators. */
function caretAfterNthDigit(text: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch && /\d/.test(ch)) {
      seen++
      if (seen === digitCount) return i + 1
    }
  }
  return text.length
}

export function CurrencyInput({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  format,
  parse,
  startAddon,
  endAddon,
  className,
}: CurrencyInputProps) {
  const ref = React.useRef<HTMLInputElement>(null)
  const pendingCaretDigits = React.useRef<number | null>(null)

  const displayed = value ? format(value) : ""

  React.useLayoutEffect(() => {
    const el = ref.current
    const digitCount = pendingCaretDigits.current
    if (!el || digitCount === null) return
    pendingCaretDigits.current = null
    const pos = caretAfterNthDigit(displayed, digitCount)
    el.setSelectionRange(pos, pos)
  }, [displayed])

  return (
    <Input
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      inputMode="numeric"
      placeholder="0"
      className={className}
      startAddon={startAddon}
      endAddon={endAddon}
      value={displayed}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const el = e.target
        const caret = el.selectionStart ?? el.value.length
        const digitsBeforeCaret = (el.value.slice(0, caret).match(/\d/g) ?? [])
          .length
        pendingCaretDigits.current = digitsBeforeCaret
        onChange(parse(el.value))
      }}
    />
  )
}
