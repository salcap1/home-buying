#!/usr/bin/env node
/**
 * Reads coverage/coverage-summary.json and writes .github/badges/coverage.svg
 * Run after: npm run test:coverage
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const summaryPath = join(root, "coverage", "coverage-summary.json");
const outPath = join(root, ".github", "badges", "coverage.svg");

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch {
  console.error(`Missing ${summaryPath}. Run npm run test:coverage first.`);
  process.exit(1);
}

const pct = Number(summary.total?.lines?.pct);
if (!Number.isFinite(pct)) {
  console.error("coverage-summary.json has no total.lines.pct");
  process.exit(1);
}

const label = "coverage";
const value = `${pct.toFixed(1)}%`;
const color = pct >= 80 ? "#4c1" : pct >= 60 ? "#97ca00" : pct >= 45 ? "#dfb317" : "#e05d44";

function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]);
}

const labelWidth = 64;
const valueWidth = 54;
const height = 20;
const width = labelWidth + valueWidth;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="m"><rect width="${width}" height="${height}" rx="3" fill="#fff"/></mask>
  <g mask="url(#m)">
    <rect width="${labelWidth}" height="${height}" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${color}"/>
    <rect width="${width}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${value})`);
