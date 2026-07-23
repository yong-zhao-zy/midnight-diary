/**
 * Timezone-aware date utilities.
 *
 * All business date comparisons in this project use China Standard Time
 * (Asia/Shanghai, UTC+8). Using `new Date()` local methods directly would
 * depend on the browser/device timezone, which can cause off-by-one errors
 * for users whose device is set to a non-CST timezone.
 */

/**
 * Get today's date in Asia/Shanghai timezone as YYYY-MM-DD.
 */
export function todayShanghaiStr(): string {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

/**
 * Subtract one day from a YYYY-MM-DD string.
 * Uses local Date arithmetic (calendar-date math, timezone-independent).
 */
export function minusOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
