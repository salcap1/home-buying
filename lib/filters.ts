import { analyzeHouse, defaultDown } from "./calc";
import type { Assumptions, BoardRule, Destination, House, School, Schools } from "./types";

export function schoolName(value?: School | string | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.name || "";
}

function highSchoolNames(schools?: Schools | null, highSchool?: string) {
  const names: string[] = [];
  if (highSchool) names.push(highSchool);
  const high = schoolName(schools?.high);
  if (high) names.push(high);
  return names;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function schoolExcluded(name: string, patterns: string[]) {
  const text = String(name || "");
  for (const pattern of patterns) {
    const raw = String(pattern || "").trim();
    if (!raw) continue;
    if (new RegExp(escapeRegExp(raw), "i").test(text)) return raw;
  }
  return "";
}

export type SkipContext = {
  schools?: Schools | null;
  highSchool?: string;
  housing?: number | null;
  driveMinutes?: number | null;
  driveLabel?: string;
  excludeSchools?: string[];
  rules?: BoardRule[];
};

export function skipReasons({
  schools,
  highSchool,
  housing,
  driveMinutes,
  driveLabel,
  excludeSchools = [],
  rules = [],
}: SkipContext = {}) {
  const reasons: string[] = [];
  const schoolPatterns = [
    ...excludeSchools,
    ...rules
      .filter((rule): rule is Extract<BoardRule, { kind: "exclude_school" }> => rule.kind === "exclude_school")
      .map((rule) => rule.config.pattern),
  ];
  for (const name of highSchoolNames(schools, highSchool)) {
    const blocked = schoolExcluded(name, schoolPatterns);
    if (blocked && !reasons.includes(blocked)) reasons.push(blocked);
  }
  for (const rule of rules) {
    if (rule.kind === "max_housing" && housing != null && Number(housing) >= Number(rule.config.amount)) {
      const cap = Math.round(Number(rule.config.amount));
      reasons.push(`monthly payment is $${Math.round(Number(housing)).toLocaleString()} (over $${cap.toLocaleString()})`);
    }
    if (rule.kind === "max_drive" && driveMinutes != null && Number(driveMinutes) >= Number(rule.config.minutes)) {
      const label = driveLabel || "commute destination";
      reasons.push(`${Math.round(Number(driveMinutes))} min from ${label}`);
    }
  }
  return reasons;
}

export function skipReasonsForHouse(
  house: {
    price?: number | null;
    updateCash?: number | null;
    downDollars?: number | null;
    schools?: Schools | null;
    highSchool?: string;
  },
  assumptions?: Assumptions | null,
  extras: {
    highSchool?: string;
    housing?: number;
    driveMinutes?: number;
    driveLabel?: string;
    excludeSchools?: string[];
    rules?: BoardRule[];
  } = {}
) {
  const next = {
    ...house,
    downDollars:
      house.downDollars ??
      (assumptions ? defaultDown(house.price || 0, assumptions, house.updateCash || 0) : 0),
  };
  const analysis = assumptions ? analyzeHouse(next as House, assumptions) : null;
  return skipReasons({
    schools: next.schools,
    highSchool: extras.highSchool || schoolName(next.schools?.high),
    housing: extras.housing ?? analysis?.housing,
    driveMinutes: extras.driveMinutes,
    driveLabel: extras.driveLabel,
    excludeSchools: extras.excludeSchools,
    rules: extras.rules,
  });
}

export function skipMessage(reasons?: string[]) {
  if (!reasons?.length) return "";
  return `Skipping this house: ${reasons.join("; ")}.`;
}

/** Destination named by a max_drive rule, else the first destination. */
export function driveDestination(
  destinations?: Destination[] | null,
  rules?: BoardRule[] | null
): Destination | null {
  const places = destinations || [];
  const driveRule = (rules || []).find(
    (rule): rule is Extract<BoardRule, { kind: "max_drive" }> => rule.kind === "max_drive"
  );
  if (driveRule?.config.destinationId) {
    const match = places.find((item) => item.id === driveRule.config.destinationId);
    if (match) return match;
  }
  return places[0] || null;
}
