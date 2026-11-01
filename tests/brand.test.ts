import { brandCssVars, getBrand, listBrands } from "@/lib/brand";

describe("brand", () => {
  it("falls back to the default theme", () => {
    expect(getBrand("unknown").id).toBe("default");
    expect(listBrands()).toEqual(["default"]);
  });

  it("maps theme colors onto existing CSS variables", () => {
    const vars = brandCssVars(getBrand("default"));
    expect(vars["--paper"]).toBe("#f3eee4");
    expect(vars["--a"]).toBe("#9a3b2a");
    expect(vars["--font-display"]).toContain("Fraunces");
    expect(vars["--radius-md"]).toBe("10px");
    expect(vars["--primary"]).toBe(vars["--a"]);
  });
});
