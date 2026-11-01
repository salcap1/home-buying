export const MODULE_IDS = [
  "payments",
  "commute",
  "schools",
  "sell_to_buy",
  "household_cashflow",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULES: Record<ModuleId, { label: string; description: string }> = {
  payments: { label: "Payments", description: "Monthly housing and cash-to-close math" },
  commute: { label: "Commute", description: "Drive times to saved places" },
  schools: { label: "Schools", description: "Assigned schools and ratings" },
  sell_to_buy: { label: "Sell to buy", description: "Current-home sale proceeds" },
  household_cashflow: {
    label: "Expenses",
    description: "Named monthly amounts. Positive is money in and negative is money out",
  },
};

function parseList(raw?: string | null): ModuleId[] | null {
  if (!raw?.trim()) return null;
  const wanted = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is ModuleId => (MODULE_IDS as readonly string[]).includes(item));
  return wanted.length ? wanted : null;
}

export function enabledModules(fromBrand?: ModuleId[], fromEnv = process.env.NEXT_PUBLIC_MODULES): ModuleId[] {
  return parseList(fromEnv) || fromBrand || [...MODULE_IDS];
}

export function isModuleEnabled(id: ModuleId, enabled: ModuleId[] = enabledModules()) {
  return enabled.includes(id);
}
