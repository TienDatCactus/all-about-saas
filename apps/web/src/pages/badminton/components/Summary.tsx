import { CalculatorIcon, CopyIcon, WarningIcon } from "@phosphor-icons/react"
import type { ComputedSnapshot } from "@/services/badminton/types"
import DataCard from "@/components/custom/data/card"
import DataEmpty from "@/components/custom/data/empty"
import { toast } from "@/components/custom/toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

/**
 * What this component actually needs, which is looser than `ComputedSnapshot`:
 * rows whose `participantId` may be absent.
 *
 * `computeSplit` always sets it, but `computed` is stored as jsonb and a
 * snapshot written by an older version of the calc may not carry it — which is
 * why the response schema types it optional. This component only uses it as a
 * React key, so demanding it would be a constraint with nothing behind it.
 */
export type DisplaySnapshot = Omit<ComputedSnapshot, "rows"> & {
  rows: Array<
    Omit<ComputedSnapshot["rows"][number], "participantId"> & {
      participantId?: string
    }
  >
}

interface PaymentMethodDisplay {
  type: "image" | "phone"
  label: string
  imageUrl?: string | null
  phoneNumber?: string | null
}

interface SummaryProps {
  computed: DisplaySnapshot
  meta?: { title?: string | null; playedOn?: string }
  paymentMethod?: PaymentMethodDisplay | null
  paymentStatus?: Record<string, { paid: boolean }>
  onTogglePaid?: (participantId: string, paid: boolean) => void
}

export function BadmintonSummary({
  computed,
  meta,
  paymentMethod,
  paymentStatus,
  onTogglePaid,
}: SummaryProps) {
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
          tabIndex={-1}
          variant="outline"
          size="sm"
          onClick={(e) => {
            void handleCopy(e)
          }}
          disabled={!hasRows}
        >
          <CopyIcon data-icon="inline-start" />
          Copy
        </Button>
      }
      content={
        hasRows ? (
          <div className="flex flex-col gap-4">
            {Math.abs(computed.roundingResidual) > 999 && (
              <Alert variant="destructive">
                <WarningIcon />
                <AlertDescription>
                  {`${formatDong(computed.roundingResidual)} of the total expense was not collected from anyone — likely because every player was excluded from court hours or shuttle weight.`}
                </AlertDescription>
              </Alert>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Court</TableHead>
                    <TableHead className="text-right">Shuttle</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {paymentMethod && <TableHead>Payment</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computed.rows.map((row, index) => (
                    <TableRow key={row.participantId ?? `${index}-${row.name}`}>
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
                      {paymentMethod && (
                        <TableCell>
                          <PaymentCell
                            row={row}
                            method={paymentMethod}
                            paid={
                              row.participantId
                                ? paymentStatus?.[row.participantId]?.paid
                                : undefined
                            }
                            onTogglePaid={
                              row.participantId && onTogglePaid
                                ? (paid) =>
                                    onTogglePaid(row.participantId!, paid)
                                : undefined
                            }
                          />
                        </TableCell>
                      )}
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
            {paymentMethod?.type === "image" && paymentMethod.imageUrl && (
              <div className="flex flex-col items-center gap-2 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {paymentMethod.label}
                </p>
                <img
                  src={paymentMethod.imageUrl}
                  alt={`QR nhận tiền: ${paymentMethod.label}`}
                  className="h-64 w-64 rounded-lg border object-contain"
                />
              </div>
            )}
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

function PaymentCell({
  row,
  method,
  paid,
  onTogglePaid,
}: {
  row: DisplaySnapshot["rows"][number]
  method: PaymentMethodDisplay
  paid: boolean | undefined
  onTogglePaid?: (paid: boolean) => void
}) {
  const payUrl =
    method.type === "phone" && method.phoneNumber
      ? `https://nhantien.momo.vn/${method.phoneNumber}?amount=${Math.round(row.total)}&note=${encodeURIComponent(row.name)}`
      : undefined

  return (
    <div className="flex items-center justify-end gap-2">
      {payUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={payUrl} target="_blank" rel="noopener noreferrer">
            Thanh toán
          </a>
        </Button>
      )}
      {paid === undefined ? null : onTogglePaid ? (
        <Button
          variant={paid ? "default" : "outline"}
          size="sm"
          onClick={() => onTogglePaid(!paid)}
        >
          {paid ? "Đã trả" : "Chưa trả"}
        </Button>
      ) : (
        <Badge variant={paid ? "default" : "secondary"}>
          {paid ? "Đã trả" : "Chưa trả"}
        </Badge>
      )}
    </div>
  )
}
