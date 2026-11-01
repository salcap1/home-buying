import { driveDestination, skipReasons } from "@/lib/filters";
import type { BoardRule, Destination } from "@/lib/types";

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
