import { TrashIcon } from "@phosphor-icons/react"
import { PlayerNameInput } from "./PlayerNameInput"
import type React from "react"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"

interface PlayerRowProps {
  form: any
  index: number
  canRemove: boolean
  onRemove: () => void
}

/**
 * Wire a numeric TanStack Form field to a text/number `<input>` while keeping the
 * stored value a real `number`. `input.value` is always a string, so spreading
 * the default `inputProps` stored `"3"` / `""` — which the API's `@IsInt()`/`@Min(0)`
 * validators then reject. Coerce on every change and clamp to the field's bounds.
 */
function numberFieldProps(
  field: any,
  isInvalid: boolean,
  {
    integer = false,
    min,
    max,
  }: { integer?: boolean; min?: number; max?: number } = {}
) {
  return {
    name: field.name,
    "aria-invalid": isInvalid,
    value: field.state.value ?? "",
    onBlur: field.handleBlur,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let n = e.target.valueAsNumber
      if (Number.isNaN(n)) n = min ?? 0
      if (integer) n = Math.trunc(n)
      if (min !== undefined) n = Math.max(min, n)
      if (max !== undefined) n = Math.min(max, n)
      field.handleChange(n)
    },
  }
}

export function PlayerRow({
  form,
  index,
  canRemove,
  onRemove,
}: PlayerRowProps) {
  const base = `players[${index}]`
  return (
    <TableRow key={base}>
      <TableCell>
        <FormField form={form} label="Name" name={`${base}.name`}>
          {({ field, isInvalid }) => (
            <PlayerNameInput
              id={`${base}-name`}
              name={field.name}
              value={field.state.value ?? ""}
              onValueChange={(next) => {
                field.handleChange(next)

                form.setFieldValue(`${base}.userId`, undefined)
              }}
              onPickUser={(userId, pickedName) => {
                field.handleChange(pickedName)
                form.setFieldValue(`${base}.userId`, userId)
              }}
              onBlur={field.handleBlur}
              aria-invalid={isInvalid}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <FormField
          form={form}
          label="Shuttle %"
          name={`${base}.shuttlePercent`}
        >
          {({ field, isInvalid }) => (
            <Input
              id={`${base}-shuttle`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              endAddon="%"
              className="text-right tabular-nums"
              {...numberFieldProps(field, isInvalid, { min: 0, max: 100 })}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <FormField form={form} label="Court %" name={`${base}.courtPercent`}>
          {({ field, isInvalid }) => (
            <Input
              id={`${base}-court`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              endAddon="%"
              className="text-right tabular-nums"
              {...numberFieldProps(field, isInvalid, { min: 0, max: 100 })}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <FormField
          form={form}
          label="Discount %"
          name={`${base}.discountPercent`}
        >
          {({ field, isInvalid }) => (
            <Input
              id={`${base}-discount`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              endAddon="%"
              className="text-right tabular-nums"
              {...numberFieldProps(field, isInvalid, { min: 0, max: 100 })}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell className="align-bottom">
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="Remove player"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <TrashIcon />
        </Button>
      </TableCell>
    </TableRow>
  )
}
