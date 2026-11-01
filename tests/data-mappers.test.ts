import { mapAssumptions, mapExtras, mapHouse, mapSchools, num } from "@/lib/data/mappers";

describe("num", () => {
  it("coerces finite numbers and falls back otherwise", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("nope", 3)).toBe(3);
    expect(num(undefined, 1)).toBe(1);
    expect(num(null)).toBe(0);
  });
});

describe("mapAssumptions", () => {
  it("maps nullable agent percents and money fields", () => {
    const next = mapAssumptions({
      sale_price: "800000",
      payoff: 200000,
      extra_cash: 0,
      keep_cash: 50000,
      current_housing: 3000,
      realtor_pct: "",
      other_selling_pct: null,
      other_selling_fees: 845,
      closing_pct: 2,
      term_years: 30,
      tax_pct: 1,
      pmi_pct: 0.5,
      rate: 6.5,
      extra_items: [{ label: "Income", amount: 100, enabled: true }],
      destinations: "not-json",
    });
    expect(next.listingAgentPct).toBeNull();
    expect(next.buyerAgentPct).toBeNull();
    expect(next.otherSellingFees).toBe(845);
    expect(next.extraItems).toHaveLength(1);
    expect(next.destinations).toEqual([]);
  });
});

describe("mapHouse", () => {
  it("maps a listing row", () => {
    const house = mapHouse({
      id: "h1",
      name: "Sample",
      url: "https://example.com",
      price: "500000",
      down_dollars: 100000,
      rate: 6.5,
      insurance_monthly: 150,
      tax_monthly: null,
      hoa: 0,
      update_cash: 0,
      extra_items: [],
      lat: null,
      lng: null,
      schools: {},
      facts: {},
      photo: "",
      notes: "",
      hearted: true,
      sort_order: 2,
    });
    expect(house.id).toBe("h1");
    expect(house.price).toBe(500000);
    expect(house.taxMonthly).toBeNull();
    expect(house.hearted).toBe(true);
  });
});

describe("mapExtras", () => {
  it("parses JSON strings and drops invalid payloads", () => {
    expect(mapExtras('[{"label":"A","amount":1}]')).toEqual([
      { id: "extra-0", label: "A", amount: 1, enabled: true },
    ]);
    expect(mapExtras("{")).toEqual([]);
  });
});

describe("mapSchools", () => {
  it("wraps string and object school entries", () => {
    const schools = mapSchools({
      elementary: "Elm",
      middle: { name: "Mid", rating: 7, lat: 0, lng: 0 },
      high: { name: "High", rating: 8, lat: 35.1, lng: -80.8 },
    });
    expect(schools.elementary.name).toBe("Elm");
    expect(schools.middle.lat).toBeNull();
    expect(schools.high.lat).toBe(35.1);
  });
});
