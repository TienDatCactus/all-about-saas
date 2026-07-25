import { CoinsIcon, CurrencyCircleDollarIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import { Button as StatefulButton } from "@/components/custom/stateful-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { formatVnd, parseVnd } from "@/lib/badminton/format";
import type { BadmintonSession } from "@/services/badminton/types";
import {
  useCreateSessionMutation,
  useUpdateSessionMutation,
} from "@/services/badminton/queries";
import {
  defaultValues,
  hasNamedPlayer,
  valuesToComputed,
  valuesToPayload,
  type EditorValues,
} from "./form";
import { PlayerEditor } from "./player-editor";
import { BadmintonSummary } from "./summary";

interface SessionEditorProps {
  sessionId?: string;
  initialValues?: EditorValues;
  onSaved?: (session: BadmintonSession) => void;
}

export function SessionEditor({
  sessionId,
  initialValues,
  onSaved,
}: SessionEditorProps) {
  const create = useCreateSessionMutation();
  const update = useUpdateSessionMutation(sessionId ?? "");
  const status = sessionId ? update.status : create.status;

  const form = useForm({
    defaultValues: initialValues ?? defaultValues(),
    onSubmit: async ({ value }: { value: EditorValues }) => {
      const payload = valuesToPayload(value);
      const saved = sessionId
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload);
      onSaved?.(saved);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,26rem)] lg:items-start"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session details</CardTitle>
            <CardDescription>Court and shuttle costs for the day.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="title" label="Title">
                  {({ inputProps }) => (
                    <Input placeholder="Friday night" {...inputProps} />
                  )}
                </FormField>

                <FormField form={form} name="playedOn" label="Date">
                  {({ inputProps }) => <Input type="date" {...inputProps} />}
                </FormField>

                <Field>
                  <FieldLabel htmlFor="courtCost">Court cost</FieldLabel>
                  <form.Field name="courtCost">
                    {(f: any) => (
                      <Input
                        id="courtCost"
                        inputMode="numeric"
                        aria-label="Court cost"
                        placeholder="0"
                        className="text-right tabular-nums"
                        startAddon={<CurrencyCircleDollarIcon />}
                        endAddon="₫"
                        value={f.state.value ? formatVnd(f.state.value) : ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          f.handleChange(parseVnd(e.target.value))
                        }
                      />
                    )}
                  </form.Field>
                  <FieldDescription>
                    Total court rental, split by time played.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="shuttlePrice">
                    Shuttle price (each)
                  </FieldLabel>
                  <form.Field name="shuttleUnitPrice">
                    {(f: any) => (
                      <Input
                        id="shuttlePrice"
                        inputMode="numeric"
                        aria-label="Shuttle price per shuttle"
                        placeholder="0"
                        className="text-right tabular-nums"
                        startAddon={<CoinsIcon />}
                        endAddon="₫"
                        value={f.state.value ? formatVnd(f.state.value) : ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          f.handleChange(parseVnd(e.target.value))
                        }
                      />
                    )}
                  </form.Field>
                  <FieldDescription>
                    Shuttle total = price × shuttles counted below.
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              Court % is time played (100% = full session). Discount lowers the
              whole bill and is shared by everyone else.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlayerEditor form={form} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
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
  );
}
