import { DataError, withData } from "@/lib/data/errors";

describe("DataError", () => {
  it("wraps unknown failures", async () => {
    await expect(
      withData("demo", async () => {
        throw new Error("boom");
      })
    ).rejects.toMatchObject({ name: "DataError", code: "UNKNOWN", message: "demo failed" });
  });

  it("passes DataError through", async () => {
    await expect(
      withData("demo", async () => {
        throw new DataError("missing", "NOT_FOUND");
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "missing" });
  });
});
