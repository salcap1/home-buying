import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().optional(),
    HOME_BUYING_STORAGE_DATABASE_URL: z.string().optional(),
    DATABASE_PROVIDER: z.enum(["neon"]).default("neon"),
    CRON_SECRET: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    DEMO_ORG_ID: z.string().default("demo"),
    DEMO_BOARD_ID: z.string().default("demo"),
  },
  client: {
    NEXT_PUBLIC_BRAND: z.string().default("default"),
    NEXT_PUBLIC_MODULES: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    HOME_BUYING_STORAGE_DATABASE_URL: process.env.HOME_BUYING_STORAGE_DATABASE_URL,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    CRON_SECRET: process.env.CRON_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DEMO_ORG_ID: process.env.DEMO_ORG_ID,
    DEMO_BOARD_ID: process.env.DEMO_BOARD_ID,
    NEXT_PUBLIC_BRAND: process.env.NEXT_PUBLIC_BRAND,
    NEXT_PUBLIC_MODULES: process.env.NEXT_PUBLIC_MODULES,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.VITEST),
});
