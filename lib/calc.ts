import type { Assumptions, House } from "./types";

export function pmt(annualRate: number, years: number, principal: number) {
  const n = years * 12;
  if (n <= 0 || principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  const pow = Math.pow(1 + r, n);
  return (principal * r * pow) / (pow - 1);
}

function agentPct(value: unknown) {
  if (value === "" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function saleFigures(assumptions: Assumptions) {
  const salePrice = Number(assumptions.salePrice) || 0;
  const listingPct = agentPct(assumptions.listingAgentPct);
  const buyerPct = agentPct(assumptions.buyerAgentPct);
  const listingCommission = salePrice * (listingPct / 100);
  const buyerCommission = salePrice * (buyerPct / 100);
  const otherSellingFees = Number(assumptions.otherSellingFees) || 0;
  const sellingCosts = listingCommission + buyerCommission + otherSellingFees;
  const netProceeds = salePrice - sellingCosts - (Number(assumptions.payoff) || 0);
  const cashBeforeTax = netProceeds + (Number(assumptions.extraCash) || 0);
  const cashAvailable = cashBeforeTax - keepCashAmount(assumptions);
  return {
    listingCommission,
    buyerCommission,
    otherSellingFees,
    sellingCosts,
    netProceeds,
    cashBeforeTax,
    cashAfterTax: cashBeforeTax,
    cashAvailable,
  };
}

export function keepCashAmount(assumptions?: Pick<Assumptions, "keepCash"> | null) {
  const n = Number(assumptions?.keepCash);
  return Number.isFinite(n) ? n : 0;
}

export function defaultDown(price: number, assumptions: Assumptions, updateCash = 0) {
  const { cashAvailable } = saleFigures(assumptions);
  const listPrice = Math.max(0, Number(price) || 0);
  const closing = listPrice * ((Number(assumptions.closingPct) || 0) / 100);
  const updates = Math.max(0, Number(updateCash) || 0);
  const down = cashAvailable - closing - updates;
  return Math.max(0, Math.min(listPrice, Math.round(down)));
}

/** Checked expense lines. Positive is money in; negative is money out. */
export function expenseTotal(items: { amount?: number | null; enabled?: boolean }[] | null | undefined) {
  return (items || []).reduce((sum, item) => {
    if (item.enabled === false) return sum;
    return sum + (Number(item.amount) || 0);
  }, 0);
}

export function analyzeHouse(house: House, assumptions: Assumptions) {
  const price = house.price;
  const down = Math.max(0, house.downDollars);
  const downPct = price > 0 ? (down / price) * 100 : 0;
  const loan = Math.max(0, price - down);
  const closing = price * (assumptions.closingPct / 100);
  const { cashAvailable } = saleFigures(assumptions);
  const updateCash = Math.max(0, house.updateCash || 0);
  const cashNeeded = down + closing + updateCash;
  const surplus = cashAvailable - cashNeeded;
  const saleUsed = Math.max(0, Math.min(cashAvailable, cashNeeded));
  const rate = Number(assumptions.rate ?? house.rate ?? 6.5) || 0;
  const pi = pmt(rate / 100, assumptions.termYears, loan);
  const tax = Number(house.taxMonthly) || 0;
  const housing = pi + tax + house.insuranceMonthly + house.hoa;
  const vsCurrent = assumptions.currentHousing ? housing - assumptions.currentHousing : null;
  // Today is $0. Stopping today's payment is money in; the new monthly payment is money out.
  const gap =
    expenseTotal(assumptions.extraItems) + (Number(assumptions.currentHousing) || 0) - housing;

  return {
    down,
    downPct,
    loan,
    closing,
    cashAvailable,
    cashNeeded,
    surplus,
    updateCash,
    saleUsed,
    pi,
    tax,
    housing,
    vsCurrent,
    gap,
  };
}

export type HouseAnalysis = ReturnType<typeof analyzeHouse>;
