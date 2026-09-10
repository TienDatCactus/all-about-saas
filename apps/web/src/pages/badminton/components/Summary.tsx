import {
  CalculatorIcon,
  CheckIcon,
  CopyIcon,
  QrCodeIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"
import type { ComputedSnapshot } from "@/services/badminton/types"
import { DataImagePreview } from "@/components/custom/data/image-preview"
import DataCard from "@/components/custom/data/card"
import DataEmpty from "@/components/custom/data/empty"
import { toast } from "@/components/custom/toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
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
  meta?: {
    title?: string | null
    playedOn?: string
    totalShuttleCount?: number
    defaultHoursPlayed?: number
  }
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
  const { t } = useTranslation()
  const hasRows = computed.rows.length > 0

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault()
      await navigator.clipboard.writeText(buildSummaryText(computed, meta))
      toast.success(t("badminton.summary.copySuccess"))
    } catch {
      toast.error(t("badminton.summary.copyError"))
    }
  }
  return (
    <DataCard
      title={t("badminton.summary.title")}
      description={
        <p className="text-sm text-muted-foreground">
          {t("badminton.summary.courtFee")}{" "}
          <span className="font-medium text-foreground">
            {formatDong(computed.courtCost)}
          </span>
          {" · "}
          {t("badminton.summary.shuttleFee")}{" "}
          <span className="font-medium text-foreground">
            {formatDong(computed.shuttleCost)}
          </span>
          {" · "}
          {t("badminton.summary.shuttleCount", {
            count: meta?.totalShuttleCount ?? 0,
          })}
          {" · "}
          {t("badminton.summary.defaultHours", {
            hours: meta?.defaultHoursPlayed ?? 1,
          })}
        </p>
      }
      action={
        <div className="flex gap-2">
          {paymentMethod?.type === "image" && paymentMethod.imageUrl && (
            <DataImagePreview
              image={{
                src: paymentMethod.imageUrl,
                alt: t("badminton.summary.qrAlt", {
                  label: paymentMethod.label,
                }),
                downloadName: `${paymentMethod.label}-qr.png`,
              }}
            >
              <Button tabIndex={-1} variant="outline" size="sm">
                <QrCodeIcon data-icon="inline-start" />
                {t("badminton.summary.qrCode")}
              </Button>
            </DataImagePreview>
          )}
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
            {t("badminton.summary.copy")}
          </Button>
        </div>
      }
      content={
        <div className="flex flex-col gap-4">
          {hasRows ? (
            <div className="flex flex-col gap-4">
              {Math.abs(computed.roundingResidual) > 999 && (
                <Alert variant="destructive">
                  <WarningIcon />
                  <AlertDescription>
                    {t("badminton.summary.roundingResidual", {
                      amount: formatDong(computed.roundingResidual),
                    })}
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("badminton.summary.table.player")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("badminton.summary.table.court")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("badminton.summary.table.shuttle")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("badminton.summary.table.total")}
                      </TableHead>
                      {paymentMethod && (
                        <TableHead className="text-center">
                          {t("badminton.summary.table.payment")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computed.rows.map((row, index) => (
                      <TableRow
                        key={row.participantId ?? `${index}-${row.name}`}
                      >
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
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
                      <TableCell>
                        {t("badminton.summary.totalCollected")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatVnd(computed.courtCost)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatVnd(computed.shuttleCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatVnd(computed.grandTotal)}
                      </TableCell>
                      {/* Keeps the footer's cell count equal to the header's and
                          the body's — one short, the browser drops the footer's
                          last column out from under the Payment header. */}
                      {paymentMethod && <TableCell />}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          ) : (
            <DataEmpty
              media={{ variant: "icon", icon: <CalculatorIcon /> }}
              title={t("badminton.summary.empty.title")}
              description={t("badminton.summary.empty.description")}
            />
          )}
        </div>
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
  const { t } = useTranslation()
  const payUrl =
    method.type === "phone" && method.phoneNumber
      ? `https://nhantien.momo.vn/${encodeURIComponent(method.phoneNumber)}?amount=${Math.round(row.total)}&note=${encodeURIComponent(row.name)}`
      : undefined

  return (
    <div className="flex items-center justify-center gap-2">
      {payUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={payUrl} target="_blank" rel="noopener noreferrer">
            {t("badminton.summary.pay")}
          </a>
        </Button>
      )}
      {paid === undefined ? null : onTogglePaid ? (
        <Toggle
          aria-label={
            paid
              ? t("badminton.summary.markUnpaid")
              : t("badminton.summary.markPaid")
          }
          pressed={paid}
          onPressedChange={onTogglePaid}
          size="sm"
          variant="outline"
        >
          {paid ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <XIcon data-icon="inline-start" />
          )}
          {paid ? t("badminton.summary.paid") : t("badminton.summary.unpaid")}
        </Toggle>
      ) : (
        <Badge variant={paid ? "default" : "secondary"}>
          {paid ? t("badminton.summary.paid") : t("badminton.summary.unpaid")}
        </Badge>
      )}
    </div>
  )
}
