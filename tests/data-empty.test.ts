import { createEmptyStore } from "@/lib/data/empty";
import { DataError } from "@/lib/data/errors";

describe("createEmptyStore", () => {
  const store = createEmptyStore();

  it("reads as empty while locked", async () => {
    expect(store.provider).toBe("empty");
    expect(await store.houses.list()).toEqual([]);
    expect(await store.dismissed.listKeys()).toEqual([]);
    expect(await store.boards.listByAccessKey("access-1")).toEqual([]);
    const assumptions = await store.assumptions.get();
    expect(assumptions.salePrice).toBe(0);
  });

  it("rejects writes until unlock", () => {
    expect(() => store.houses.setHearted("h1", true)).toThrow(DataError);
    expect(() => store.assumptions.update({} as never)).toThrow(/Unlock the board first/);
  });
});


