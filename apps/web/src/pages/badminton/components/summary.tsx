import { CalculatorIcon, CopyIcon } from "@phosphor-icons/react"
import type { ComputedSnapshot } from "@/services/badminton/types"
import DataCard from "@/components/custom/data/card"
import DataEmpty from "@/components/custom/data/empty"
import { toast } from "@/components/custom/toast"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDong, formatVnd } from "@/pages/badminton/lib/format"
import { buildSummaryText } from "@/pages/badminton/lib/summary-text"

interface SummaryProps {
  computed: ComputedSnapshot
  meta?: { title?: string | null; playedOn?: string }
}

export function BadmintonSummary({ computed, meta }: SummaryProps) {
  const hasRows = computed.rows.length > 0

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault()
      await navigator.clipboard.writeText(buildSummaryText(computed, meta))
      toast.success("Summary copied to clipboard")
    } catch {
      toast.error("Couldn't copy — check clipboard permissions")
    }
  }
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
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatDong(row.court)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatDong(row.shuttle)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatDong(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total collected</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatVnd(computed.courtCost)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
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
          <DataEmpty
            media={{ variant: "icon", icon: <CalculatorIcon /> }}
            title="Nothing to split yet"
            description="Add players and costs to see each person's share."
          />
        )
      }
    />
  )
}
