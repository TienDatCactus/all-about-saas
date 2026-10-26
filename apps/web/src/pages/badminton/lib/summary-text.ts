import type { TFunction } from "i18next"
import { formatDong, formatVnd } from "./format"
import type { DisplaySnapshot } from "@/pages/badminton/components/Summary"

/**
 * Plain-text summary for one-click copy into chat apps (Zalo / Messenger).
 * Name-and-total, right-aligned amounts, kept simple so it pastes cleanly.
 */
export function buildSummaryText(
  t: TFunction,
  computed: DisplaySnapshot,
  meta?: {
    title?: string | null
    playedOn?: string
    totalShuttleCount?: number
    defaultHoursPlayed?: number
  }
): string {
  const heading = meta?.title?.trim() || t("badminton.summary.title")
  const lines: Array<string> = [`- ${heading}`]
  if (meta?.playedOn) lines.push(meta.playedOn)
  lines.push(
    [
      `${t("badminton.summary.courtFee")} ${formatDong(computed.courtCost)}`,
      `${t("badminton.summary.shuttleFee")} ${formatDong(computed.shuttleCost)}`,
      t("badminton.summary.shuttleCount", { n: meta?.totalShuttleCount ?? 0 }),
      t("badminton.summary.defaultHours", {
        hours: meta?.defaultHoursPlayed ?? 1,
      }),
    ].join(" · ")
  )
  lines.push("")

  const nameWidth = Math.max(4, ...computed.rows.map((r) => r.name.length))
  const amountWidth = Math.max(
    ...computed.rows.map((r) => formatVnd(r.total).length),
    formatVnd(computed.grandTotal).length
  )

  for (const row of computed.rows) {
    lines.push(
      `${row.name.padEnd(nameWidth)}  ${formatVnd(row.total).padStart(amountWidth)}`
    )
  }

  const totalLabel = t("badminton.summary.table.total")
  lines.push("")
  lines.push(
    `${totalLabel.padEnd(nameWidth)}  ${formatVnd(computed.grandTotal).padStart(amountWidth)} ₫`
  )
  return lines.join("\n")
}
