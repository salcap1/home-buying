#!/usr/bin/env node
/**
 * Set one password for a workspace (all linked search tabs).
 * Usage: node scripts/set-workspace-password.mjs <accessKeyId> <password> [boardId...]
 * Example: node scripts/set-workspace-password.mjs personal 'secret' charlotte nova
 * Requires DATABASE_URL or HOME_BUYING_STORAGE_DATABASE_URL.
 */
import { randomBytes, scryptSync } from "crypto";
import { neon } from "@neondatabase/serverless";

const accessKeyId = process.argv[2];
const password = process.argv[3];
const boardIds = process.argv.slice(4);
if (!accessKeyId || !password) {
  console.error("Usage: node scripts/set-workspace-password.mjs <accessKeyId> <password> [boardId...]");
  process.exit(1);
}

const url = process.env.HOME_BUYING_STORAGE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL or HOME_BUYING_STORAGE_DATABASE_URL");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const stored = `${salt.toString("base64")}:${hash.toString("base64")}`;

const db = neon(url);
await db`
  INSERT INTO home_buying.access_keys (id, password_hash, label)
  VALUES (${accessKeyId}, ${stored}, ${accessKeyId})
  ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
`;
if (boardIds.length) {
  await db`
    UPDATE home_buying.boards
    SET access_key_id = ${accessKeyId}
    WHERE id = ANY(${boardIds})
  `;
}
const linked = await db`
  SELECT id, name FROM home_buying.boards
  WHERE access_key_id = ${accessKeyId}
  ORDER BY created_at
`;
console.log(
  `Password set for access key ${accessKeyId}; boards: ${linked.map((row) => row.id).join(", ") || "(none linked)"}`
);
