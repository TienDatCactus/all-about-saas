import type { ComputedSnapshot } from "@/services/badminton/types"
import { formatVnd } from "./format"

/**
 * Plain-text summary for one-click copy into chat apps (Zalo / Messenger).
 * Name-and-total, right-aligned amounts, kept simple so it pastes cleanly.
 */
export function buildSummaryText(
  computed: ComputedSnapshot,
  meta?: { title?: string | null; playedOn?: string }
): string {
  const heading = meta?.title?.trim() || "Badminton split"
  const lines: string[] = [`🏸 ${heading}`]
  if (meta?.playedOn) lines.push(meta.playedOn)
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

  lines.push("")
  lines.push(
    `${"Total".padEnd(nameWidth)}  ${formatVnd(computed.grandTotal).padStart(amountWidth)} ₫`
  )
  return lines.join("\n")
}
