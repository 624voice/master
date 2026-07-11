export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatMultiple(value: number): string {
  return `${Math.round(value)}x`;
}

export function formatPaybackMonths(months: number | null): string {
  if (months === null) return "—";
  if (months < 1) return "< 1 mo";
  return `${months} mo`;
}
