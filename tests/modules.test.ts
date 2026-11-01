import { MODULE_IDS, enabledModules, isModuleEnabled } from "@/lib/modules";

describe("modules", () => {
  it("defaults to the full catalog", () => {
    expect(enabledModules()).toEqual([...MODULE_IDS]);
  });

  it("honors an env list over the brand list", () => {
    expect(enabledModules(["payments", "schools"], "commute,sell_to_buy")).toEqual(["commute", "sell_to_buy"]);
  });

  it("checks a single flag", () => {
    expect(isModuleEnabled("household_cashflow", ["payments"])).toBe(false);
    expect(isModuleEnabled("payments", ["payments"])).toBe(true);
  });
});
