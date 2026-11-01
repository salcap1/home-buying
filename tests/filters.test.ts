import { driveDestination, schoolName, skipMessage, skipReasons, skipReasonsForHouse } from "@/lib/filters";
import type { Assumptions, BoardRule, Destination } from "@/lib/types";
import { EMPTY_SCHOOLS } from "@/lib/types";

const destinations: Destination[] = [
  { id: "work", name: "Work", address: "1 Main", lat: 1, lng: 1 },
  { id: "school", name: "School", address: "2 Main", lat: 2, lng: 2 },
];

const rules: BoardRule[] = [
  { kind: "max_housing", config: { amount: 4000 } },
  { kind: "max_drive", config: { destinationId: "work", minutes: 35 } },
  { kind: "exclude_school", config: { pattern: "Blocked" } },
];

describe("skipReasons", () => {
  it("uses board rules and exclude lists", () => {
    const reasons = skipReasons({
      highSchool: "Blocked High School",
      housing: 4100,
      driveMinutes: 40,
      driveLabel: "Work",
      excludeSchools: [],
      rules,
    });
    expect(reasons.some((item) => /Blocked/i.test(item))).toBe(true);
    expect(reasons.some((item) => /over \$4,000/.test(item))).toBe(true);
    expect(reasons.some((item) => /40 min from Work/.test(item))).toBe(true);
  });

  it("skips checks when thresholds are not crossed", () => {
    expect(
      skipReasons({
        highSchool: "Open High",
        housing: 3900,
        driveMinutes: 20,
        rules,
      })
    ).toEqual([]);
  });
});

describe("driveDestination", () => {
  it("picks the max_drive destination when present", () => {
    expect(driveDestination(destinations, rules)?.id).toBe("work");
  });

  it("falls back to the first destination", () => {
    expect(driveDestination(destinations, [])?.id).toBe("work");
  });
});

describe("schoolName", () => {
  it("reads a string or School object", () => {
    expect(schoolName("Open High")).toBe("Open High");
    expect(schoolName({ name: "Open High", rating: 8, source: "", url: "", lat: null, lng: null })).toBe(
      "Open High"
    );
    expect(schoolName(null)).toBe("");
  });
});

describe("skipMessage", () => {
  it("joins reasons for the UI copy", () => {
    expect(skipMessage([])).toBe("");
    expect(skipMessage(["Blocked", "too far"])).toBe("Skipping this house: Blocked; too far.");
  });
});

describe("skipReasonsForHouse", () => {
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

  it("forwards house schools and explicit housing into skipReasons", () => {
    const reasons = skipReasonsForHouse(
      {
        price: 500000,
        downDollars: 100000,
        schools: {
          ...EMPTY_SCHOOLS,
          high: { name: "Blocked High", rating: 5, source: "", url: "", lat: null, lng: null },
        },
        updateCash: 0,
      },
      assumptions,
      { rules, housing: 4500, driveMinutes: 10 }
    );
    expect(reasons.some((item) => /Blocked/i.test(item))).toBe(true);
    expect(reasons.some((item) => /monthly payment/i.test(item))).toBe(true);
  });

  it("ignores payment math when assumptions are missing", () => {
    expect(
      skipReasonsForHouse(
        { price: 900000, schools: EMPTY_SCHOOLS, highSchool: "Open High" },
        null,
        { rules: [{ kind: "exclude_school", config: { pattern: "Blocked" } }] }
      )
    ).toEqual([]);
  });
});
