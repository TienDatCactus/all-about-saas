import {
  CoinsIcon,
  CurrencyCircleDollarIcon,
  RacquetIcon,
} from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import {
  defaultValues,
  hasNamedPlayer,
  valuesToComputed,
  valuesToPayload,
} from "../../lib/form"
import { CurrencyInput } from "../CurrencyInput"
import { HoursStepperInput } from "../HoursStepperInput"
import { PaymentMethodPicker } from "../PaymentMethodPicker"
import { PlayerEditor } from "../player-editor"
import { BadmintonSummary } from "../Summary"
import type { BadmintonSession } from "@/services/badminton/types"
import type { EditorValues } from "../../lib/form"
import { AddonInput as Input } from "@/components/custom/addon-input"
import DataCard from "@/components/custom/data/card"
import DataDialog from "@/components/custom/data/dialog"
import { FormField } from "@/components/custom/form-field"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import DatePicker from "@/components/date-picker"
import { Field, FieldGroup } from "@/components/ui/field"
import {
  useCreateSessionMutation,
  useUpdateSessionMutation,
} from "@/services/badminton/queries"
import { ShuttlePriceCalc } from "./ShuttlePriceCalc"
import { Button } from "@/components/ui/button"

interface SessionEditorProps {
  sessionId?: string
  initialValues?: EditorValues
  onSaved?: (session: BadmintonSession) => void
  /** Owner-selected payment method for this session, or `null`/absent if none is set. */
  paymentMethod?: BadmintonSession["paymentMethod"]
  /** Raw id backing `paymentMethod`, for the picker's own selection state. */
  paymentMethodId?: string | null
  /** Per-participant paid status, keyed by participant id. */
  paymentStatus?: Record<string, { paid: boolean }>
  /** Omit to render the summary's payment status read-only (public share view). */
  onTogglePaid?: (participantId: string, paid: boolean) => void
}

export function SessionEditor({
  sessionId,
  initialValues,
  onSaved,
  paymentMethod,
  paymentMethodId,
  paymentStatus,
  onTogglePaid,
}: SessionEditorProps) {
  const create = useCreateSessionMutation()
  const update = useUpdateSessionMutation(sessionId ?? "")
  const status = sessionId ? update.status : create.status
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

  const form = useForm({
    defaultValues: initialValues ?? defaultValues(),
    onSubmit: async ({ value }: { value: EditorValues }) => {
      const payload = valuesToPayload(value)
      const saved = sessionId
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload)
      setMobileSummaryOpen(false)
      onSaved?.(saved)
    },
  })

  const summaryAndSave = (
    <div className="space-y-4">
      <form.Subscribe selector={(s: { values: EditorValues }) => s.values}>
        {(values: EditorValues) => (
          <BadmintonSummary
            computed={valuesToComputed(values)}
            meta={{
              title: values.title,
              playedOn: values.playedOn,
              totalShuttleCount: values.totalShuttleCount,
              defaultHoursPlayed: values.defaultHoursPlayed,
            }}
            paymentMethod={paymentMethod}
            paymentStatus={paymentStatus}
            onTogglePaid={onTogglePaid}
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
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit().catch(() => undefined)
      }}
      className="grid gap-6 lg:grid-cols-5 lg:items-start"
    >
      <div className="col-span-3 flex min-w-0 flex-col gap-6">
        <DataCard
          title="Session details"
          description="Court and shuttle costs for the day."
          action={
            sessionId && (
              <Field orientation={"horizontal"}>
                <p>Payment method:</p>
                <PaymentMethodPicker
                  sessionId={sessionId}
                  value={paymentMethodId}
                />
              </Field>
            )
          }
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  form={form}
                  name="courtCost"
                  label="Court cost"
                  description="Total cost for the court, shared by all players."
                >
                  {({ field }) => (
                    <CurrencyInput
                      id="courtCost"
                      aria-label="Court cost"
                      className="text-right tabular-nums"
                      startAddon={<CurrencyCircleDollarIcon />}
                      endAddon="₫"
                      value={field.state.value}
                      onChange={field.handleChange}
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
                    <div className="stack-row gap-2">
                      <CurrencyInput
                        id="shuttleUnitPrice"
                        aria-label="Shuttle price per shuttle"
                        className="text-right tabular-nums"
                        startAddon={<CoinsIcon />}
                        endAddon="₫"
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                      <ShuttlePriceCalc onApply={field.handleChange} />
                    </div>
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
                <FormField
                  form={form}
                  name="defaultHoursPlayed"
                  label="Default play time"
                  description="Applies to every current player and anyone added after."
                >
                  {({ field }) => (
                    <HoursStepperInput
                      id="defaultHoursPlayed"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(next) => {
                        field.handleChange(next)
                        const players = form.getFieldValue("players") as Array<{
                          hoursPlayed: number
                        }>
                        players.forEach((_, i) => {
                          form.setFieldValue(`players[${i}].hoursPlayed`, next)
                        })
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
          description="Hours played splits the court fee. Shuttle weight splits the shuttle pot — tap Male/Female for the 6/4 default."
          content={<PlayerEditor form={form} />}
        />
        <Button
          onClick={(e) => {
            e.preventDefault()
            setMobileSummaryOpen(true)
          }}
          className="w-full lg:hidden"
        >
          View Changes
        </Button>
      </div>
      <div className="col-span-2 flex hidden flex-col gap-4 lg:sticky lg:top-6 lg:block">
        {summaryAndSave}
      </div>

      <DataDialog
        open={mobileSummaryOpen}
        onOpenChange={setMobileSummaryOpen}
        title="Split summary"
        content={<div className="flex flex-col gap-4">{summaryAndSave}</div>}
      />
    </form>
  )
}
