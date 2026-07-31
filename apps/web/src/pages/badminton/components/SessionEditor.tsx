import { AddonInput as Input } from "@/components/custom/addon-input"
import DataCard from "@/components/custom/data/card"
import { FormField } from "@/components/custom/form-field"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import DatePicker from "@/components/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { formatVnd, parseVnd } from "@/pages/badminton/lib/format"
import {
  useCreateSessionMutation,
  useUpdateSessionMutation,
} from "@/services/badminton/queries"
import type { BadmintonSession } from "@/services/badminton/types"
import {
  CoinsIcon,
  CurrencyCircleDollarIcon,
  RacquetIcon,
} from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { format, parseISO } from "date-fns"
import {
  defaultValues,
  hasNamedPlayer,
  valuesToComputed,
  valuesToPayload,
  type EditorValues,
} from "../lib/form"
import { PlayerEditor } from "./player-editor"
import { BadmintonSummary } from "./Summary"

interface SessionEditorProps {
  sessionId?: string
  initialValues?: EditorValues
  onSaved?: (session: BadmintonSession) => void
}

export function SessionEditor({
  sessionId,
  initialValues,
  onSaved,
}: SessionEditorProps) {
  const create = useCreateSessionMutation()
  const update = useUpdateSessionMutation(sessionId ?? "")
  const status = sessionId ? update.status : create.status

  const form = useForm({
    defaultValues: initialValues ?? defaultValues(),
    onSubmit: async ({ value }: { value: EditorValues }) => {
      const payload = valuesToPayload(value)
      const saved = sessionId
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload)
      onSaved?.(saved)
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="grid gap-6 lg:grid-cols-5 lg:items-start"
    >
      <div className="col-span-3 flex min-w-0 flex-col gap-6">
        <DataCard
          title="Session details"
          description="Court and shuttle costs for the day."
          content={
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="title" label="Title">
                  {({ inputProps }) => (
                    <Input placeholder="Friday night" {...inputProps} />
                  )}
                </FormField>

                <FormField form={form} name="playedOn" label="Date">
                  {({ field, isInvalid }) => (
                    <DatePicker
                      id="playedOn"
                      name={field.name}
                      aria-invalid={isInvalid}
                      value={
                        field.state.value
                          ? parseISO(field.state.value)
                          : undefined
                      }
                      onChange={(date) =>
                        field.handleChange(
                          date ? format(date, "yyyy-MM-dd") : ""
                        )
                      }
                      onBlur={field.handleBlur}
                    />
                  )}
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  form={form}
                  name="courtCost"
                  label="Court cost"
                  description="Total cost for the court, shared by all players."
                >
                  {({ field }) => (
                    <Input
                      id="courtCost"
                      inputMode="numeric"
                      aria-label="Court cost"
                      placeholder="0"
                      className="text-right tabular-nums"
                      startAddon={<CurrencyCircleDollarIcon />}
                      endAddon="₫"
                      value={
                        field.state.value ? formatVnd(field.state.value) : ""
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        field.handleChange(parseVnd(e.target.value))
                      }
                    />
                  )}
                </FormField>
                <FormField
                  form={form}
                  name="shuttleUnitPrice"
                  label="Shuttle price (each)"
                  description="Shuttle total = price × total shuttles."
                >
                  {({ field }) => (
                    <Input
                      id="shuttleUnitPrice"
                      inputMode="numeric"
                      aria-label="Shuttle price per shuttle"
                      placeholder="0"
                      className="text-right tabular-nums"
                      startAddon={<CoinsIcon />}
                      endAddon="₫"
                      value={
                        field.state.value ? formatVnd(field.state.value) : ""
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        field.handleChange(parseVnd(e.target.value))
                      }
                    />
                  )}
                </FormField>
                <FormField
                  form={form}
                  name="totalShuttleCount"
                  label="Total shuttles"
                  description="Total shuttle count for the session, shared by all players."
                >
                  {({ field }) => (
                    <Input
                      id="totalShuttleCount"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      aria-label="Total shuttles"
                      placeholder="0"
                      className="text-right tabular-nums"
                      startAddon={<RacquetIcon />}
                      value={field.state.value ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const n = e.target.valueAsNumber
                        field.handleChange(
                          Number.isNaN(n) ? 0 : Math.max(0, Math.trunc(n))
                        )
                      }}
                    />
                  )}
                </FormField>
              </div>
            </FieldGroup>
          }
        />
        <DataCard
          title="Players"
          description="Court % is time played (100% = full session). Discount lowers the
              whole bill and is shared by everyone else."
          content={<PlayerEditor form={form} />}
        />
      </div>

      <div className="col-span-2 flex flex-col gap-4 lg:sticky lg:top-6">
        <form.Subscribe selector={(s: { values: EditorValues }) => s.values}>
          {(values: EditorValues) => (
            <BadmintonSummary
              computed={valuesToComputed(values)}
              meta={{ title: values.title, playedOn: values.playedOn }}
            />
          )}
        </form.Subscribe>

        <form.Subscribe
          selector={(s: { values: EditorValues }) => hasNamedPlayer(s.values)}
        >
          {(canSave: boolean) => (
            <StatefulButton
              type="button"
              size="lg"
              className="w-full"
              mutationState={status}
              disabled={!canSave}
              onClick={form.handleSubmit}
            >
              {sessionId ? "Save changes" : "Save session"}
            </StatefulButton>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}
