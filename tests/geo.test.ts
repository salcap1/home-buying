import { afterEach, describe, expect, it, vi } from "vitest";
import { distancesFrom, driveMatrix } from "@/lib/geo";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("driveMatrix", () => {
  it("asks OSRM once for every listing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/table/v1/driving/");
      expect(String(url)).toContain("sources=0;1");
      expect(String(url)).toContain("destinations=2");
      return jsonResponse({
        code: "Ok",
        durations: [[600], [1200]],
        distances: [[16093.44], [32186.88]],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await driveMatrix(
      [
        { id: "a", lat: 35.1, lng: -80.8 },
        { id: "b", lat: 35.2, lng: -80.7 },
      ],
      [{ id: "work", lat: 35.0, lng: -80.9 }]
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { id: "a", distances: [{ id: "work", miles: 10, minutes: 10, mode: "drive" }] },
      { id: "b", distances: [{ id: "work", miles: 20, minutes: 20, mode: "drive" }] },
    ]);
  });

  it("keeps a pin with no route as a straight-line distance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          code: "Ok",
          durations: [[null]],
          distances: [[null]],
        })
      )
    );

    const [row] = await driveMatrix(
      [{ id: "a", lat: 35.1, lng: -80.8 }],
      [{ id: "work", lat: 35.2, lng: -80.8 }]
    );

    expect(row.distances[0].mode).toBe("straight");
    expect(row.distances[0].miles).toBeGreaterThan(0);
    expect(row.distances[0].minutes).toBeNull();
  });

  it("skips the router when a place has no coordinates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const [row] = await driveMatrix(
      [{ id: "a", lat: 35.1, lng: -80.8 }],
      [{ id: "work", lat: null, lng: null }]
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(row.distances).toEqual([{ id: "work", miles: null, minutes: null }]);
  });

  it("falls back to one route per pair when the table request fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/table/")) return jsonResponse({}, false);
      return jsonResponse({ routes: [{ distance: 1609.344, duration: 120 }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [row] = await driveMatrix(
      [{ id: "a", lat: 35.1, lng: -80.8 }],
      [{ id: "work", lat: 35.0, lng: -80.9 }]
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(row.distances).toEqual([{ id: "work", miles: 1, minutes: 2, mode: "drive" }]);
  });

  it("splits a long shortlist so each table call stays within the coordinate cap", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        code: "Ok",
        durations: Array.from({ length: 99 }, () => [60]),
        distances: Array.from({ length: 99 }, () => [1609.344]),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const origins = Array.from({ length: 100 }, (_, index) => ({
      id: `h${index}`,
      lat: 35,
      lng: -80,
    }));
    const results = await driveMatrix(origins, [{ id: "work", lat: 35.1, lng: -80.1 }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(100);
    expect(results[0].distances[0].minutes).toBe(1);
  });
});

describe("distancesFrom", () => {
  it("uses one table call for every saved place", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        code: "Ok",
        durations: [[60, 120]],
        distances: [[1609.344, 3218.688]],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const distances = await distancesFrom({ lat: 35.1, lng: -80.8 }, [
      { id: "work", lat: 35.0, lng: -80.9 },
      { id: "school", lat: 35.2, lng: -80.7 },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(distances.map((item) => item.id)).toEqual(["work", "school"]);
    expect(distances.map((item) => item.minutes)).toEqual([1, 2]);
  });
});
