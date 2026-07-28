const vndNumber = new Intl.NumberFormat("vi-VN");
const vndCurrency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/** 150000 -> "150.000" (Vietnamese grouping, no symbol). */
export function formatVnd(amount: number): string {
  return vndNumber.format(Math.round(amount || 0));
}

/** 150000 -> "150.000 ₫". */
export function formatDong(amount: number): string {
  return vndCurrency.format(Math.round(amount || 0));
}

/** Parse a user-typed amount ("150.000", "150,000", "150000") back to a number. */
export function parseVnd(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
