/**
 * Format a price + currency in a localized way without dropping info.
 * USD/EUR/GBP get their symbol; PLN stays as " zł" (Polish convention).
 */

const SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  PLN: "zł",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
};

export function formatPrice(price: number | string | null | undefined, currency: string = "PLN"): string {
  if (price === null || price === undefined || price === "") return "—";
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num)) return "—";

  const cur = (currency || "PLN").toUpperCase();
  const sym = SYMBOL[cur] ?? cur;
  const rounded = Number.isInteger(num) ? num.toString() : num.toFixed(2);
  if (cur === "PLN" || cur === "SEK" || cur === "NOK" || cur === "DKK" || cur === "CZK") {
    return `${rounded} ${sym}`;
  }
  return `${sym}${rounded}`;
}

export function formatMaxPrice(price: number | string | null | undefined, currency: string = "PLN"): string {
  if (price === null || price === undefined || price === "") return "∞";
  return formatPrice(price, currency);
}
