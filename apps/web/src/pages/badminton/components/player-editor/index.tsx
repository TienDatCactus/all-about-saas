import { FormField } from "@/components/custom/form-field";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon } from "@phosphor-icons/react";
import { newPlayer, type EditorPlayer } from "../../lib/form";
import { PlayerRow } from "./PlayerRow";

interface PlayerEditorProps {
  form: any;
}
export function PlayerEditor({ form }: PlayerEditorProps) {
  return (
    <FormField form={form} name="players">
      {({ field }) => {
        const players: EditorPlayer[] = field.state.value;
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell className="text-right">Shuttle %</TableCell>
                <TableCell className="text-right">Court %</TableCell>
                <TableCell className="text-right">Discount %</TableCell>
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

                size="sm"
                onClick={() => field.pushValue(newPlayer())}
              >
                <PlusIcon />
                Add player
              </Button>
            </TableCaption>
          </Table>
        );
      }}
    </FormField>
  );
}
