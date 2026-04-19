/**
 * Parses the official spoiler HTML from the Item Randomiser mod
 * and updates locations.json with proper human-readable descriptions.
 *
 * Source: https://gibberlings3.github.io/Documentation/readmes/spoilers-randomiser.html
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const spoilerPath = resolve(__dirname, "..", "spoilers.html");
const locationsPath = resolve(__dirname, "..", "src", "data", "locations.json");

// Parse spoiler HTML for location tables
const html = readFileSync(spoilerPath, "utf8");
const locations = JSON.parse(readFileSync(locationsPath, "utf8"));

// Extract all location sections from the spoiler HTML
// Sections we care about:
//   locations_bg1, locations_totsc, locations_soa, locations_tob
//   bg1scrolllocs, bg2scrolllocs
//   foa_loc, kangaxx_loc
// We skip "weidu_" (Mode 2) sections since our data is from base mode.

interface SpoilerEntry {
  tier: string;
  description: string;
  area: string;
}

function extractLocationTable(
  html: string,
  sectionName: string
): SpoilerEntry[] {
  // Find the section anchor
  const anchorPattern = new RegExp(
    `name="${sectionName}"[^>]*>.*?<table[^>]*>(.*?)</table>`,
    "s"
  );
  const match = html.match(anchorPattern);
  if (!match) {
    console.warn(`Section "${sectionName}" not found in spoiler HTML`);
    return [];
  }

  const tableContent = match[1];
  const entries: SpoilerEntry[] = [];

  // Parse each table row (skip header row)
  const rowRegex = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    entries.push({
      tier: rowMatch[1].trim(),
      description: rowMatch[2].trim(),
      area: rowMatch[3].trim(),
    });
  }

  return entries;
}

// Extract all location sections
const allSpoilerEntries: SpoilerEntry[] = [
  ...extractLocationTable(html, "locations_bg1"),
  ...extractLocationTable(html, "locations_totsc"),
  ...extractLocationTable(html, "locations_soa"),
  ...extractLocationTable(html, "locations_tob"),
  ...extractLocationTable(html, "bg1scrolllocs"),
  ...extractLocationTable(html, "bg2scrolllocs"),
  ...extractLocationTable(html, "foa_loc"),
  ...extractLocationTable(html, "kangaxx_loc"),
];

console.log(`Parsed ${allSpoilerEntries.length} spoiler entries`);

// Group spoiler entries by tier, maintaining order
const spoilerByTier: Record<string, SpoilerEntry[]> = {};
for (const entry of allSpoilerEntries) {
  if (!spoilerByTier[entry.tier]) spoilerByTier[entry.tier] = [];
  spoilerByTier[entry.tier].push(entry);
}

// Group our locations by tier, maintaining order
const locationsByTier: Record<string, typeof locations> = {};
for (const loc of locations) {
  const tier = loc.tier || loc.id.split(":")[0];
  if (!locationsByTier[tier]) locationsByTier[tier] = [];
  locationsByTier[tier].push(loc);
}

// Match: within each tier, spoiler entries and our locations are in the same order
let updated = 0;
let mismatched = 0;
let missing = 0;

for (const tier of Object.keys(locationsByTier)) {
  const ourLocs = locationsByTier[tier];
  const spoilerLocs = spoilerByTier[tier];

  if (!spoilerLocs) {
    console.warn(`No spoiler data for tier ${tier}`);
    missing += ourLocs.length;
    continue;
  }

  if (ourLocs.length !== spoilerLocs.length) {
    console.warn(
      `Tier ${tier}: count mismatch — ours=${ourLocs.length}, spoiler=${spoilerLocs.length}`
    );
  }

  const count = Math.min(ourLocs.length, spoilerLocs.length);
  for (let i = 0; i < count; i++) {
    const loc = ourLocs[i];
    const spoiler = spoilerLocs[i];

    // Verify area codes match as a sanity check
    if (loc.area !== spoiler.area) {
      console.warn(
        `Tier ${tier} index ${i}: area mismatch — ours=${loc.area}, spoiler=${spoiler.area} — "${spoiler.description}"`
      );
      mismatched++;
      // Still update since the order should be authoritative
    }

    loc.comment = spoiler.description;
    updated++;
  }
}

console.log(`\nResults:`);
console.log(`  Updated: ${updated}`);
console.log(`  Area mismatches: ${mismatched}`);
console.log(`  Missing spoiler data: ${missing}`);
console.log(`  Total locations: ${locations.length}`);

// Write updated locations
writeFileSync(locationsPath, JSON.stringify(locations, null, 2) + "\n");
console.log(`\nWritten to ${locationsPath}`);
