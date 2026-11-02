#!/usr/bin/env node
/**
 * Apply db/schema.sql to the DATABASE_URL in the environment (or .env.local).
 * Use your own Neon project — never someone else's production database.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "db", "schema.sql");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

const url = process.env.HOME_BUYING_STORAGE_DATABASE_URL || process.env.DATABASE_URL;
if (!url || !String(url).trim()) {
  console.error(`DATABASE_URL is not set.

Create a free Neon project at https://console.neon.tech (your own account),
copy the connection string into .env.local, then re-run:

  npm run db:setup

Do not use someone else's production database.`);
  process.exit(1);
}

let schema;
try {
  schema = readFileSync(schemaPath, "utf8");
} catch {
  console.error(`Missing ${schemaPath}`);
  process.exit(1);
}

/** Split SQL into statements; strip line comments; keep CREATE/ALTER blocks intact. */
function statementsFrom(sql) {
  const withoutLineComments = sql
    .split("\n")
    .map((line) => {
      const hash = line.indexOf("--");
      return hash === -1 ? line : line.slice(0, hash);
    })
    .join("\n");

  return withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const sql = neon(url);
const statements = statementsFrom(schema);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Applied ${statements.length} statements from db/schema.sql`);
console.log("Empty home_buying schema is ready. Create an account in the app to start a board.");
