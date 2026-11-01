import { describe, expect, it } from "vitest";
import { inCircle } from "@/lib/search-area";

describe("inCircle", () => {
  const charlotte = { lat: 35.054, lng: -80.851, radiusMiles: 35 };

  it("keeps a point inside the radius", () => {
    expect(inCircle(35.1, -80.8, charlotte)).toBe(true);
  });

  it("rejects a point in Northern Virginia when the circle is Charlotte", () => {
    expect(inCircle(38.85, -77.3, charlotte)).toBe(false);
  });
});
