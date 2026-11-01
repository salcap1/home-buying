const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function money(value: number) {
  return usd0.format(Math.round(Number(value) || 0));
}

export function moneyFine(value: number) {
  return usd2.format(Number(value) || 0);
}

export function signedMoney(value: number) {
  const n = Number(value) || 0;
  const formatted = moneyFine(Math.abs(n));
  if (Math.abs(n) < 0.005) return moneyFine(0);
  return n < 0 ? `(${formatted})` : formatted;
}

export function signedDelta(value: number) {
  const n = Number(value) || 0;
  const formatted = money(Math.abs(n));
  if (Math.abs(n) < 0.5) return money(0);
  return n < 0 ? `${formatted} lower` : `${formatted} higher`;
}

export function pct(value: number, digits = 1) {
  return `${(Number(value) || 0).toFixed(digits)}%`;
}

export function minutesLabel(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n} min`;
}

export function count(value: number) {
  return (Number(value) || 0).toLocaleString("en-US");
}
