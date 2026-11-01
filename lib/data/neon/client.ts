import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import { DataError } from "../errors";

export function neonSql() {
  const url = env.HOME_BUYING_STORAGE_DATABASE_URL || env.DATABASE_URL;
  if (!url) throw new DataError("DATABASE_URL is not set", "UNAVAILABLE");
  return neon(url);
}
