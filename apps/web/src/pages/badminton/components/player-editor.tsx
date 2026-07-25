import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { AddonInput as Input } from "@/components/custom/addon-input";
import { Button } from "@/components/ui/button";
import { newPlayer, type EditorPlayer } from "./form";

const toInt = (v: string) => {
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** `form` is the useForm instance; typed loosely to match the custom FormField pattern. */
export function PlayerEditor({ form }: { form: any }) {
  return (
    <form.Field name="players" mode="array">
      {(arrayField: any) => {
        const players: EditorPlayer[] = arrayField.state.value;
        return (
          <div className="flex flex-col gap-3">
            <div className="hidden items-center gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_2.25rem]">
              <span>Player</span>
              <span className="text-right">Shuttles</span>
              <span className="text-right">Court %</span>
              <span className="text-right">Discount %</span>
              <span className="sr-only">Remove</span>
            </div>

            <ul className="flex flex-col gap-3">
              {players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  form={form}
                  index={index}
                  canRemove={players.length > 1}
                  onRemove={() => arrayField.removeValue(index)}
                />
              ))}
            </ul>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => arrayField.pushValue(newPlayer())}
              >
                <PlusIcon data-icon="inline-start" />
                Add player
              </Button>
            </div>
          </div>
        );
      }}
    </form.Field>
  );
}

interface PlayerRowProps {
  form: any;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}

function PlayerRow({ form, index, canRemove, onRemove }: PlayerRowProps) {
  const base = `players[${index}]`;
  return (
    <li className="grid grid-cols-2 items-end gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_2.25rem] sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:border-b sm:p-0 sm:pb-3">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <label
          htmlFor={`${base}-name`}
          className="text-xs text-muted-foreground sm:sr-only"
        >
          Player
        </label>
        <form.Field name={`${base}.name`}>
          {(f: any) => (
            <Input
              id={`${base}-name`}
              placeholder="Name"
              autoComplete="off"
              value={f.state.value ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                f.handleChange(e.target.value)
              }
            />
          )}
        </form.Field>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${base}-shuttles`}
          className="text-xs text-muted-foreground sm:sr-only"
        >
          Shuttles
        </label>
        <form.Field name={`${base}.shuttleCount`}>
          {(f: any) => (
            <Input
              id={`${base}-shuttles`}
              type="number"
              min={0}
              inputMode="numeric"
              className="text-right tabular-nums"
              placeholder="0"
              value={f.state.value ? String(f.state.value) : ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                f.handleChange(toInt(e.target.value))
              }
            />
          )}
        </form.Field>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${base}-court`}
          className="text-xs text-muted-foreground sm:sr-only"
        >
          Court %
        </label>
        <form.Field name={`${base}.courtPercent`}>
          {(f: any) => (
            <Input
              id={`${base}-court`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              endAddon="%"
              className="text-right tabular-nums"
              value={String(f.state.value ?? 0)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                f.handleChange(Math.min(100, toInt(e.target.value)))
              }
            />
          )}
        </form.Field>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${base}-discount`}
          className="text-xs text-muted-foreground sm:sr-only"
        >
          Discount %
        </label>
        <form.Field name={`${base}.discountPercent`}>
          {(f: any) => (
            <Input
              id={`${base}-discount`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              endAddon="%"
              className="text-right tabular-nums"
              value={String(f.state.value ?? 0)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                f.handleChange(Math.min(100, toInt(e.target.value)))
              }
            />
          )}
        </form.Field>
      </div>

      <div className="col-span-2 flex justify-end sm:col-span-1 sm:justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove player"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <TrashIcon />
        </Button>
      </div>
    </li>
  );
}
