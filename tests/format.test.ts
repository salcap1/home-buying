import { count, minutesLabel, money, moneyFine, pct, signedDelta, signedMoney } from "@/lib/format";

describe("format", () => {
  it("formats dollars", () => {
    expect(money(4300.4)).toBe("$4,300");
    expect(moneyFine(12.5)).toBe("$12.50");
  });

  it("formats signed values and percents", () => {
    expect(signedMoney(-12.5)).toBe("($12.50)");
    expect(signedDelta(-100)).toBe("$100 lower");
    expect(pct(3.5)).toBe("3.5%");
    expect(minutesLabel(18)).toBe("18 min");
    expect(count(2200)).toBe("2,200");
  });
});
