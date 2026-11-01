import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}"],
      exclude: [
        "lib/**/*.d.ts",
        "lib/brand/themes/**",
        "lib/layers/**",
        "lib/map-icons.ts",
        "lib/db.ts",
        // Integration / network-heavy; covered by manual ops and route smoke, not unit thresholds
        "lib/data/neon/**",
        "lib/schools.ts",
        "lib/school-pins.ts",
        "lib/redfin-csv.ts",
      ],
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 54,
        lines: 58,
        functions: 65,
        branches: 44,
      },
    },
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
