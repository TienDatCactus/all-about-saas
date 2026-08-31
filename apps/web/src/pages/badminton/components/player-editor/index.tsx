import { PlusIcon } from "@phosphor-icons/react"
import { newPlayer } from "../../lib/form"
import { PlayerRow } from "./PlayerRow"
import type { EditorPlayer } from "../../lib/form"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PlayerEditorProps {
  form: any
}
export function PlayerEditor({ form }: PlayerEditorProps) {
  return (
    <FormField form={form} name="players">
      {({ field }) => {
        const players: Array<EditorPlayer> = field.state.value
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell className="text-right">Hours played</TableCell>
                <TableCell>Shuttle weight</TableCell>
                <TableCell>Remove</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody>
              {players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  form={form}
                  index={index}
                  canRemove={players.length > 1}
                  onRemove={() => field.removeValue(index)}
                />
              ))}
            </TableBody>

            <TableCaption>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  field.pushValue(
                    newPlayer("", form.getFieldValue("defaultHoursPlayed"))
                  )
                }
              >
                <PlusIcon />
                Add player
              </Button>
            </TableCaption>
          </Table>
        )
      }}
    </FormField>
  )
}
