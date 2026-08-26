import { TrashIcon } from "@phosphor-icons/react"
import { PlayerNameInput } from "./PlayerNameInput"
import type React from "react"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { DEFAULT_SHUTTLE_WEIGHT, defaultShuttleWeight } from "../../lib/form"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ButtonGroup } from "@/components/ui/button-group"

interface PlayerRowProps {
  form: any
  index: number
  canRemove: boolean
  onRemove: () => void
}

function numberFieldProps(
  field: any,
  isInvalid: boolean,
  defaultValue?: number,
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
    min,
    max,
    defaultValue,
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
        <div className="stack-row gap-4">
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
          <FormField name={`${base}.gender`} label="Gender" form={form}>
            {({ field }) => (
              // Nested so this re-renders on shuttleWeight changes too — the switch
              // must reflect the NUMBER (source of truth, hand-editable), not just
              // its own last click. Typing 4 has to show "Female" even if no one
              // ever touched this switch.
              <FormField form={form} name={`${base}.shuttleWeight`}>
                {({ field: weightField }) => {
                  const isFemale = weightField.state.value === 4
                  return (
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`${base}-player-gender`}
                        checked={isFemale}
                        onCheckedChange={(checked: boolean) => {
                          const next = checked ? "female" : "male"
                          field.handleChange(next)
                          form.setFieldValue(
                            `${base}.shuttleWeight`,
                            defaultShuttleWeight(next)
                          )
                        }}
                      />
                      <Label htmlFor={`${base}-player-gender`}>
                        {isFemale ? "Female" : "Male"}
                      </Label>
                    </div>
                  )
                }}
              </FormField>
            )}
          </FormField>
        </div>
      </TableCell>

      <TableCell>
        <FormField
          form={form}
          label="Hours played"
          name={`${base}.hoursPlayed`}
        >
          {({ field, isInvalid }) => (
            <ButtonGroup>
              <Button
                variant={"outline"}
                onClick={(e) => {
                  e.preventDefault()
                  const hoursPlayed = form.getFieldValue(`${base}.hoursPlayed`)
                  form.setFieldValue(
                    `${base}.hoursPlayed`,
                    Number((hoursPlayed - 0.1).toFixed(1))
                  )
                }}
              >
                -
              </Button>
              <Input
                id={`${base}-hours`}
                type="number"
                step={0.1}
                inputMode="decimal"
                endAddon="h"
                className="w-16 text-right tabular-nums lg:w-full"
                {...numberFieldProps(field, isInvalid, 1, { min: 0 })}
              />
              <Button
                variant={"outline"}
                onClick={(e) => {
                  e.preventDefault()
                  const hoursPlayed = form.getFieldValue(`${base}.hoursPlayed`)
                  form.setFieldValue(
                    `${base}.hoursPlayed`,
                    Number((hoursPlayed + 0.1).toFixed(1))
                  )
                }}
              >
                +
              </Button>
            </ButtonGroup>
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <div className="stack-row items-end gap-2">
          <FormField
            form={form}
            label="Shuttle weight"
            name={`${base}.shuttleWeight`}
          >
            {({ field, isInvalid }) => (
              <Input
                id={`${base}-shuttle-weight`}
                type="number"
                inputMode="numeric"
                className="text-right tabular-nums"
                {...numberFieldProps(field, isInvalid, DEFAULT_SHUTTLE_WEIGHT, {
                  min: 0,
                  max: 10,
                })}
              />
            )}
          </FormField>
        </div>
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
