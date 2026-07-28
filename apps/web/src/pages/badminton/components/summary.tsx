import { CalculatorIcon, CopyIcon } from "@phosphor-icons/react";
import { toast } from "@/components/custom/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVnd } from "@/pages/badminton/lib/format";
import { buildSummaryText } from "@/pages/badminton/lib/summary-text";
import type { ComputedSnapshot } from "@/services/badminton/types";
import DataCard from "@/components/custom/data/card";

interface SummaryProps {
  computed: ComputedSnapshot;
  meta?: { title?: string | null; playedOn?: string };
}

export function BadmintonSummary({ computed, meta }: SummaryProps) {
  const hasRows = computed.rows.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(computed, meta));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy — check clipboard permissions");
    }
  };
  return (
    <DataCard
      title="Split summary"
      description="
          Collected always equals the total expense.
    "
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!hasRows}
        >
          <CopyIcon data-icon="inline-start" />
          Copy
        </Button>
      }
      content={
        hasRows ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Court</TableHead>
                  <TableHead className="text-right">Shuttle</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.rows.map((row) => (
                  <TableRow key={row.participantId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatVnd(row.court)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatVnd(row.shuttle)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatVnd(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total collected</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatVnd(computed.courtCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatVnd(computed.shuttleCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(computed.grandTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalculatorIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing to split yet</EmptyTitle>
              <EmptyDescription>
                Add players and costs to see each person&apos;s share.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      }
    />
  );
}
