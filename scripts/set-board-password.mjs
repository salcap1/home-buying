#!/usr/bin/env node
/**
 * Deprecated: passwords are per workspace, not per search tab.
 * Use: node scripts/set-workspace-password.mjs <accessKeyId> <password> [boardId...]
 */
console.error("Use scripts/set-workspace-password.mjs instead (one password unlocks all linked tabs).");
process.exit(1);
