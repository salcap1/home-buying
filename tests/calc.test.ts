import { analyzeHouse, defaultDown, expenseTotal, keepCashAmount, pmt, saleFigures } from "@/lib/calc";
import type { Assumptions, House } from "@/lib/types";
import { EMPTY_FACTS, EMPTY_SCHOOLS } from "@/lib/types";

const assumptions: Assumptions = {
  salePrice: 800000,
  payoff: 200000,
  extraCash: 0,
  keepCash: 50000,
  currentHousing: 3000,
  listingAgentPct: 2,
  buyerAgentPct: 2,
  otherSellingFees: 845,
  closingPct: 2,
  termYears: 30,
  taxPct: 1,
  pmiPct: 0.5,
  rate: 6.5,
  extraItems: [],
  destinations: [],
};

describe("pmt", () => {
  it("returns 0 for a zero principal", () => {
    expect(pmt(0.065, 30, 0)).toBe(0);
  });

  it("calculates a 30-year 6.5% payment", () => {
    expect(pmt(0.065, 30, 400000)).toBeCloseTo(2528.27, 1);
  });
});

describe("saleFigures", () => {
  it("nets proceeds after fees, payoff, and keep-cash", () => {
    const sale = saleFigures(assumptions);
    expect(sale.sellingCosts).toBeGreaterThan(0);
    expect(sale.netProceeds).toBe(assumptions.salePrice - sale.sellingCosts - assumptions.payoff);
    expect(sale.cashAvailable).toBe(sale.cashBeforeTax - assumptions.keepCash);
  });

  it("uses board listing and buyer agent percents", () => {
    const sale = saleFigures({ ...assumptions, listingAgentPct: 3, buyerAgentPct: 1 });
    expect(sale.listingCommission).toBe(assumptions.salePrice * 0.03);
    expect(sale.buyerCommission).toBe(assumptions.salePrice * 0.01);
  });

  it("treats a blank agent percent as a zero fee", () => {
    const sale = saleFigures({ ...assumptions, listingAgentPct: null, buyerAgentPct: null });
    expect(sale.listingCommission).toBe(0);
    expect(sale.buyerCommission).toBe(0);
  });

  it("uses editable other selling fees", () => {
    const sale = saleFigures({ ...assumptions, listingAgentPct: null, buyerAgentPct: null, otherSellingFees: 1200 });
    expect(sale.otherSellingFees).toBe(1200);
    expect(sale.sellingCosts).toBe(1200);
  });

});

const house: House = {
  id: "house",
  name: "Sample",
  url: "",
  price: 500000,
  downDollars: 100000,
  rate: 6.5,
  insuranceMonthly: 150,
  taxMonthly: 400,
  hoa: 50,
  updateCash: 0,
  extraItems: [{ id: "on-house", label: "Ignored", amount: 9999, enabled: true }],
  lat: null,
  lng: null,
  schools: EMPTY_SCHOOLS,
  facts: EMPTY_FACTS,
  photo: "",
  notes: "",
  hearted: false,
  sortOrder: 0,
};

describe("expenseTotal", () => {
  it("sums positive and negative amounts", () => {
    expect(expenseTotal([{ amount: 1200 }, { amount: -400 }, { amount: 50 }])).toBe(850);
  });

  it("treats a blank amount as zero", () => {
    expect(expenseTotal([{ amount: Number.NaN }, { amount: 10 }])).toBe(10);
  });

  it("skips unchecked lines", () => {
    expect(
      expenseTotal([
        { amount: 570, enabled: true },
        { amount: -230, enabled: false },
        { amount: -200 },
      ])
    ).toBe(370);
  });
});

describe("analyzeHouse", () => {
  it("uses the listing tax and leaves PMI out of housing", () => {
    const row = analyzeHouse(
      { ...house, downDollars: 50000, taxMonthly: 400 },
      { ...assumptions, taxPct: 2, pmiPct: 1 }
    );
    expect(row.tax).toBe(400);
    expect(row.housing).toBe(row.pi + 400 + house.insuranceMonthly + house.hoa);
  });

  it("uses zero tax when the listing has none", () => {
    const row = analyzeHouse({ ...house, taxMonthly: null }, { ...assumptions, taxPct: 2 });
    expect(row.tax).toBe(0);
  });

  it("sets the gap to today's housing plus money in, minus the new monthly payment", () => {
    const row = analyzeHouse(house, {
      ...assumptions,
      currentHousing: 4000,
      extraItems: [
        { id: "in", label: "Income", amount: 2000, enabled: true },
        { id: "out", label: "Cost", amount: -800, enabled: false },
        { id: "skip", label: "Ignored", amount: -5000, enabled: false },
      ],
    });
    expect(row.gap).toBe(2000 + 4000 - row.housing);
    expect(row.housing).toBe(row.pi + house.taxMonthly! + house.insuranceMonthly + house.hoa);
  });

  it("leaves today's housing out of the gap when that payment is blank", () => {
    const row = analyzeHouse(house, { ...assumptions, currentHousing: 0, extraItems: [] });
    expect(row.gap).toBe(-row.housing);
  });
});

describe("defaultDown", () => {
  it("caps the down payment at the list price", () => {
    expect(defaultDown(1, assumptions, 0)).toBe(1);
  });
});

describe("keepCashAmount", () => {
  it("reads keep-cash from assumptions", () => {
    expect(keepCashAmount(assumptions)).toBe(50000);
    expect(keepCashAmount({ keepCash: null as unknown as number })).toBe(0);
    expect(keepCashAmount(null)).toBe(0);
  });
});
