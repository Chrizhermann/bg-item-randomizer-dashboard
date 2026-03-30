import { existsSync, mkdirSync, openSync, readSync, closeSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseItems, parseLocations, parseGroups } from "./parse-2da.ts";
import type { ItemRow, LocationRow, GroupRow } from "./parse-2da.ts";
import { TLKReader } from "./read-tlk.ts";
import { readITM, findITM } from "./read-itm.ts";
import type { ITMInfo } from "./read-itm.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GAME_DIR =
  process.env.BG_GAME_DIR ||
  "C:/Games/Baldur's Gate II Enhanced Edition modded";
const MOD_DIR = join(GAME_DIR, "randomiser", "lists");
const OVERRIDE_DIR = join(GAME_DIR, "override");
const TLK_PATH = join(GAME_DIR, "lang", "en_US", "dialog.tlk");
const KEY_PATH = join(GAME_DIR, "chitin.key");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "..", "src", "data");

// ---------------------------------------------------------------------------
// BIFF archive support — read ITM files packed inside BIFF archives
// ---------------------------------------------------------------------------

interface BIFFEntry {
  fileLength: number;
  filenameOffset: number;
  filenameLength: number;
  locator: number;
}

interface ResourceEntry {
  resref: string;
  resourceType: number;
  locator: number;
}

interface KeyFile {
  biffEntries: BIFFEntry[];
  biffFilenames: string[];
  resourceEntries: ResourceEntry[];
}

// IESDP: ITM resource type is 0x03ED (the task spec incorrectly listed 0x03FE)
const ITM_RESOURCE_TYPE = 0x03ed;

/**
 * Parse the CHITIN.KEY index file that maps resource names to BIFF locations.
 */
function parseKeyFile(keyPath: string): KeyFile {
  const data = readFileSync(keyPath);

  const signature = data.toString("ascii", 0, 4);
  const version = data.toString("ascii", 4, 8);

  if (signature !== "KEY ") {
    throw new Error(`Invalid KEY signature: "${signature}"`);
  }
  if (version !== "V1  ") {
    throw new Error(`Unsupported KEY version: "${version}"`);
  }

  const numBiffEntries = data.readUInt32LE(0x08);
  const numResourceEntries = data.readUInt32LE(0x0c);
  const biffEntriesOffset = data.readUInt32LE(0x10);
  const resourceEntriesOffset = data.readUInt32LE(0x14);

  // Parse BIFF entries (each 12 bytes)
  const biffEntries: BIFFEntry[] = [];
  const biffFilenames: string[] = [];

  for (let i = 0; i < numBiffEntries; i++) {
    const offset = biffEntriesOffset + i * 12;
    const fileLength = data.readUInt32LE(offset + 0x00);
    const filenameOffset = data.readUInt32LE(offset + 0x04);
    const filenameLength = data.readUInt16LE(offset + 0x08);
    const locator = data.readUInt16LE(offset + 0x0a);

    biffEntries.push({ fileLength, filenameOffset, filenameLength, locator });

    // Read filename from the filename table (null-terminated)
    let filename = data
      .toString("ascii", filenameOffset, filenameOffset + filenameLength)
      .replace(/\0+$/, "");
    // Normalize path separators (KEY files use backslashes)
    filename = filename.replace(/\\/g, "/");
    biffFilenames.push(filename);
  }

  // Parse resource entries (each 14 bytes)
  const resourceEntries: ResourceEntry[] = [];

  for (let i = 0; i < numResourceEntries; i++) {
    const offset = resourceEntriesOffset + i * 14;
    const resref = data
      .toString("ascii", offset + 0x00, offset + 0x08)
      .replace(/\0+$/, "")
      .toLowerCase();
    const resourceType = data.readUInt16LE(offset + 0x08);
    const locator = data.readUInt32LE(offset + 0x0a);

    resourceEntries.push({ resref, resourceType, locator });
  }

  return { biffEntries, biffFilenames, resourceEntries };
}

/**
 * Build a lookup map: lowercase resref -> ResourceEntry for ITM resources only.
 */
function buildITMResourceMap(
  keyFile: KeyFile,
): Map<string, ResourceEntry> {
  const map = new Map<string, ResourceEntry>();
  for (const entry of keyFile.resourceEntries) {
    if (entry.resourceType === ITM_RESOURCE_TYPE) {
      map.set(entry.resref, entry);
    }
  }
  return map;
}

/**
 * Read ITM data from a BIFF archive.
 *
 * Steps:
 * 1. Extract BIFF index from locator bits 20-31
 * 2. Extract resource index from locator bits 0-13
 * 3. Look up the BIFF filename from the BIFF entries
 * 4. Open the BIFF file, find the file entry at the resource index
 * 5. Read the ITM data at the specified offset/size
 */
function readITMFromBIFF(
  gameDir: string,
  keyFile: KeyFile,
  resourceEntry: ResourceEntry,
  resref: string,
): ITMInfo | null {
  const locator = resourceEntry.locator;
  const biffIndex = (locator >>> 20) & 0xfff; // bits 20-31
  const resourceIndex = locator & 0x3fff; // bits 0-13

  if (biffIndex >= keyFile.biffFilenames.length) {
    return null;
  }

  const biffRelativePath = keyFile.biffFilenames[biffIndex];
  const biffPath = join(gameDir, biffRelativePath);

  if (!existsSync(biffPath)) {
    return null;
  }

  let fd: number;
  try {
    fd = openSync(biffPath, "r");
  } catch {
    return null;
  }

  try {
    // Read BIFF header (20 bytes)
    const biffHeader = Buffer.alloc(20);
    const headerRead = readSync(fd, biffHeader, 0, 20, 0);
    if (headerRead < 20) return null;

    const biffSig = biffHeader.toString("ascii", 0, 4);
    if (biffSig !== "BIFF") return null;

    const numFileEntries = biffHeader.readUInt32LE(0x08);
    const fileEntriesOffset = biffHeader.readUInt32LE(0x10);

    if (resourceIndex >= numFileEntries) return null;

    // Each BIFF file entry is 16 bytes
    const fileEntryOffset = fileEntriesOffset + resourceIndex * 16;
    const fileEntry = Buffer.alloc(16);
    const entryRead = readSync(fd, fileEntry, 0, 16, fileEntryOffset);
    if (entryRead < 16) return null;

    const dataOffset = fileEntry.readUInt32LE(0x04);
    const dataSize = fileEntry.readUInt32LE(0x08);

    // We only need the first 16 bytes of the ITM (signature + name strrefs)
    const itmHeaderSize = Math.min(16, dataSize);
    if (itmHeaderSize < 16) return null;

    const itmHeader = Buffer.alloc(itmHeaderSize);
    const itmRead = readSync(fd, itmHeader, 0, itmHeaderSize, dataOffset);
    if (itmRead < itmHeaderSize) return null;

    const itmSig = itmHeader.toString("ascii", 0, 4);
    if (itmSig !== "ITM ") return null;

    const unidentifiedNameStrref = itmHeader.readInt32LE(0x08);
    const identifiedNameStrref = itmHeader.readInt32LE(0x0c);

    return {
      resref,
      unidentifiedNameStrref,
      identifiedNameStrref,
    };
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Target type classification
// ---------------------------------------------------------------------------

function classifyTarget(
  target: string,
): "container" | "creature" | "group" | "script" | "store" | "unknown" {
  if (target.endsWith(".cre")) return "creature";
  if (target.endsWith(".flg")) return "group";
  if (target.endsWith(".bcs")) return "script";
  if (target.endsWith(".sto")) return "store";
  // Starts with lowercase letter and has no extension (no dot)
  if (/^[a-z]/.test(target) && !target.includes(".")) return "container";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Region definitions — best-guess initial mapping
// ---------------------------------------------------------------------------

interface RegionDef {
  id: string;
  name: string;
  areaPattern: string;
  game: "bg1" | "bg2";
  sortOrder: number;
}

function generateRegions(): RegionDef[] {
  const regions: RegionDef[] = [];
  let order = 0;

  // BG2 regions based on area code ranges
  const bg2Regions: Array<[string, string, string]> = [
    ["bg2-athkatla-waukeen", "Athkatla - Waukeen's Promenade", "^ar0(?:7[0-9][0-9])$"],
    ["bg2-athkatla-slums", "Athkatla - Slums", "^ar0(?:4[0-9][0-9])$"],
    ["bg2-athkatla-docks", "Athkatla - Docks", "^ar0(?:3[0-9][0-9])$"],
    ["bg2-athkatla-gates", "Athkatla - City Gates", "^ar0(?:0[0-9][0-9])$"],
    ["bg2-athkatla-bridge", "Athkatla - Bridge District", "^ar0(?:5[0-9][0-9])$"],
    ["bg2-athkatla-graveyard", "Athkatla - Graveyard", "^ar0(?:8[0-9][0-9])$"],
    ["bg2-athkatla-temple", "Athkatla - Temple District", "^ar0(?:9[0-9][0-9])$"],
    ["bg2-athkatla-government", "Athkatla - Government", "^ar1(?:0[0-9][0-9])$"],
    ["bg2-de-arnise", "De'Arnise Keep", "^ar1(?:1[0-9][0-9])$"],
    ["bg2-trademeet", "Trademeet", "^ar2(?:0[0-9][0-9])$"],
    ["bg2-umar-hills", "Umar Hills", "^ar1(?:1[0-9][0-9]|2[0-9][0-9])$"],
    ["bg2-windspear", "Windspear Hills", "^ar1(?:2[0-9][0-9])$"],
    ["bg2-underdark", "Underdark", "^ar2(?:1[0-9][0-9]|2[0-9][0-9])$"],
    ["bg2-brynnlaw", "Brynnlaw", "^ar1(?:6[0-9][0-9])$"],
    ["bg2-spellhold", "Spellhold", "^ar1(?:5[0-9][0-9])$"],
    ["bg2-sahuagin", "Sahuagin City", "^ar2(?:3[0-9][0-9])$"],
    ["bg2-suldanessellar", "Suldanessellar", "^ar2(?:8[0-9][0-9])$"],
    ["bg2-tob", "Throne of Bhaal", "^ar(?:3|4|5|6)[0-9]{3}$"],
  ];

  for (const [id, name, pattern] of bg2Regions) {
    regions.push({ id, name, areaPattern: pattern, game: "bg2", sortOrder: order++ });
  }

  regions.push({
    id: "bg2-other",
    name: "BG2 - Other",
    areaPattern: "^ar(?!2[6-9])[0-9]{4}$",
    game: "bg2",
    sortOrder: order++,
  });

  // BG1 EET regions (ar2600+ range in EET)
  const bg1Regions: Array<[string, string, string]> = [
    ["bg1-candlekeep", "Candlekeep", "^ar26[0-9]{2}$"],
    ["bg1-friendly-arm", "Friendly Arm Inn", "^ar27[0-9]{2}$"],
    ["bg1-beregost", "Beregost", "^ar28[0-9]{2}$"],
    ["bg1-nashkel", "Nashkel", "^ar29[0-9]{2}$"],
    ["bg1-baldurs-gate", "Baldur's Gate City", "^ar(?:3[0-9]|0[1-2])[0-9]{2}$"],
    ["bg1-cloakwood", "Cloakwood", "^ar(?:21|22)[0-9]{2}$"],
    ["bg1-wilderness", "BG1 Wilderness", "^ar(?:2[0-9]|3[0-9])[0-9]{2}$"],
  ];

  for (const [id, name, pattern] of bg1Regions) {
    regions.push({ id, name, areaPattern: pattern, game: "bg1", sortOrder: order++ });
  }

  regions.push({
    id: "bg1-other",
    name: "BG1 - Other",
    areaPattern: "^ar[2-9][0-9]{3}$",
    game: "bg1",
    sortOrder: order++,
  });

  // Catch-all
  regions.push({
    id: "other",
    name: "Other",
    areaPattern: ".*",
    game: "bg2",
    sortOrder: order++,
  });

  return regions;
}

// ---------------------------------------------------------------------------
// Main extraction pipeline
// ---------------------------------------------------------------------------

function main() {
  console.log("=== BG Item Randomizer Data Extraction ===\n");

  // Validate paths
  if (!existsSync(GAME_DIR)) {
    console.error(`ERROR: Game directory not found: ${GAME_DIR}`);
    console.error("Set BG_GAME_DIR environment variable to your game path.");
    process.exit(1);
  }
  if (!existsSync(MOD_DIR)) {
    console.error(`ERROR: Mod lists directory not found: ${MOD_DIR}`);
    process.exit(1);
  }
  if (!existsSync(TLK_PATH)) {
    console.error(`ERROR: TLK file not found: ${TLK_PATH}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Step 1: Parse all 2DA files
  // -------------------------------------------------------------------------
  console.log("Parsing 2DA files...");

  const bg2Items = parseItems(join(MOD_DIR, "items", "base", "bg2.2da"));
  const bg1Items = parseItems(join(MOD_DIR, "items", "base", "bg1.2da"));
  console.log(`  BG2 items: ${bg2Items.length}`);
  console.log(`  BG1 items: ${bg1Items.length}`);

  const bg2Locations = parseLocations(join(MOD_DIR, "locations", "base", "bg2.2da"));
  const bg1Locations = parseLocations(join(MOD_DIR, "locations", "base", "bg1.2da"));
  console.log(`  BG2 locations: ${bg2Locations.length}`);
  console.log(`  BG1 locations: ${bg1Locations.length}`);

  const bg2Groups = parseGroups(join(MOD_DIR, "groups", "bg2.2da"));
  const bg1Groups = parseGroups(join(MOD_DIR, "groups", "bg1.2da"));
  console.log(`  BG2 groups: ${bg2Groups.length}`);
  console.log(`  BG1 groups: ${bg1Groups.length}`);

  // -------------------------------------------------------------------------
  // Step 2: Open TLK reader and parse CHITIN.KEY for BIFF lookups
  // -------------------------------------------------------------------------
  console.log("\nInitializing TLK reader...");
  const tlk = new TLKReader(TLK_PATH);

  console.log("Parsing CHITIN.KEY...");
  let keyFile: KeyFile | null = null;
  let itmResourceMap: Map<string, ResourceEntry> | null = null;

  if (existsSync(KEY_PATH)) {
    keyFile = parseKeyFile(KEY_PATH);
    itmResourceMap = buildITMResourceMap(keyFile);
    console.log(`  BIFF archives: ${keyFile.biffFilenames.length}`);
    console.log(`  ITM resources in KEY: ${itmResourceMap.size}`);
  } else {
    console.warn("  WARNING: chitin.key not found, BIFF extraction disabled");
  }

  // -------------------------------------------------------------------------
  // Step 3: Resolve item names
  // -------------------------------------------------------------------------
  console.log("\nResolving item names...");

  type ItemOutput = {
    id: string;
    resref: string;
    tier: string;
    token: string;
    displayName: string;
    unidentifiedName: string;
    originalSource: string;
    comment: string;
    game: "bg1" | "bg2";
  };

  function resolveItemName(
    resref: string,
    comment: string,
  ): { displayName: string; unidentifiedName: string; source: "override" | "biff" | "comment" | "resref" } {
    // Try override first
    const overridePath = findITM(OVERRIDE_DIR, resref);
    if (overridePath) {
      const itmInfo = readITM(overridePath, resref);
      if (itmInfo) {
        const displayName = tlk.getString(itmInfo.identifiedNameStrref);
        const unidentifiedName = tlk.getString(itmInfo.unidentifiedNameStrref);
        if (displayName) {
          return { displayName, unidentifiedName, source: "override" };
        }
      }
    }

    // Try BIFF extraction
    if (keyFile && itmResourceMap) {
      const resourceEntry = itmResourceMap.get(resref.toLowerCase());
      if (resourceEntry) {
        const itmInfo = readITMFromBIFF(GAME_DIR, keyFile, resourceEntry, resref);
        if (itmInfo) {
          const displayName = tlk.getString(itmInfo.identifiedNameStrref);
          const unidentifiedName = tlk.getString(itmInfo.unidentifiedNameStrref);
          if (displayName) {
            return { displayName, unidentifiedName, source: "biff" };
          }
        }
      }
    }

    // Fall back to comment
    if (comment) {
      return { displayName: comment, unidentifiedName: "", source: "comment" };
    }

    // Fall back to resref
    return { displayName: resref, unidentifiedName: "", source: "resref" };
  }

  function processItems(
    items: ItemRow[],
    game: "bg1" | "bg2",
  ): { output: ItemOutput[]; stats: Record<string, number> } {
    const output: ItemOutput[] = [];
    const stats: Record<string, number> = { override: 0, biff: 0, comment: 0, resref: 0 };

    for (const item of items) {
      const { displayName, unidentifiedName, source } = resolveItemName(item.item, item.comment);
      stats[source]++;

      output.push({
        id: `${item.tier}:${item.token}`,
        resref: item.item,
        tier: item.tier,
        token: item.token,
        displayName,
        unidentifiedName,
        originalSource: item.source,
        comment: item.comment,
        game,
      });
    }

    return { output, stats };
  }

  const bg2Result = processItems(bg2Items, "bg2");
  const bg1Result = processItems(bg1Items, "bg1");

  const allItems = [...bg2Result.output, ...bg1Result.output];

  console.log(`\n  BG2 name resolution:`);
  console.log(`    Override: ${bg2Result.stats.override}`);
  console.log(`    BIFF:     ${bg2Result.stats.biff}`);
  console.log(`    Comment:  ${bg2Result.stats.comment}`);
  console.log(`    Resref:   ${bg2Result.stats.resref}`);

  console.log(`  BG1 name resolution:`);
  console.log(`    Override: ${bg1Result.stats.override}`);
  console.log(`    BIFF:     ${bg1Result.stats.biff}`);
  console.log(`    Comment:  ${bg1Result.stats.comment}`);
  console.log(`    Resref:   ${bg1Result.stats.resref}`);

  const totalItems = allItems.length;
  const totalResolved =
    bg2Result.stats.override +
    bg2Result.stats.biff +
    bg1Result.stats.override +
    bg1Result.stats.biff;
  const successRate =
    totalItems > 0 ? ((totalResolved / totalItems) * 100).toFixed(1) : "0";
  console.log(
    `\n  Total items: ${totalItems}, ITM-resolved: ${totalResolved} (${successRate}%)`,
  );

  // -------------------------------------------------------------------------
  // Step 4: Process locations
  // -------------------------------------------------------------------------
  console.log("\nProcessing locations...");

  type LocationOutput = {
    id: string;
    tier: string;
    locationIndex: number;
    target: string;
    area: string;
    comment: string;
    targetType: "container" | "creature" | "group" | "script" | "store" | "unknown";
    game: "bg1" | "bg2";
  };

  function processLocations(
    locations: LocationRow[],
    game: "bg1" | "bg2",
  ): LocationOutput[] {
    return locations.map((loc) => ({
      id: `${loc.tier}:${loc.location}`,
      tier: loc.tier,
      locationIndex: loc.location,
      target: loc.target,
      area: loc.area,
      comment: loc.comment,
      targetType: classifyTarget(loc.target),
      game,
    }));
  }

  const allLocations = [
    ...processLocations(bg2Locations, "bg2"),
    ...processLocations(bg1Locations, "bg1"),
  ];

  // Count target types
  const targetTypeCounts: Record<string, number> = {};
  for (const loc of allLocations) {
    targetTypeCounts[loc.targetType] = (targetTypeCounts[loc.targetType] || 0) + 1;
  }
  console.log(`  Total locations: ${allLocations.length}`);
  console.log("  Target types:", targetTypeCounts);

  // -------------------------------------------------------------------------
  // Step 5: Process groups
  // -------------------------------------------------------------------------
  console.log("\nProcessing groups...");

  function processGroups(groups: GroupRow[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const g of groups) {
      if (!result[g.group]) {
        result[g.group] = [];
      }
      result[g.group].push(g.creature);
    }
    return result;
  }

  const allGroups = {
    ...processGroups(bg2Groups),
    ...processGroups(bg1Groups),
  };

  const groupCount = Object.keys(allGroups).length;
  const creatureCount = Object.values(allGroups).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`  Groups: ${groupCount}, total creatures: ${creatureCount}`);

  // -------------------------------------------------------------------------
  // Step 6: Generate regions
  // -------------------------------------------------------------------------
  console.log("\nGenerating regions...");
  const regions = generateRegions();
  console.log(`  Regions: ${regions.length}`);

  // -------------------------------------------------------------------------
  // Step 7: Write output files
  // -------------------------------------------------------------------------
  console.log("\nWriting output files...");

  const writeJSON = (filename: string, data: unknown) => {
    const filePath = join(OUTPUT_DIR, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`  ${filename}`);
  };

  writeJSON("items.json", allItems);
  writeJSON("locations.json", allLocations);
  writeJSON("groups.json", allGroups);
  writeJSON("regions.json", regions);

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  tlk.close();

  console.log("\nDone! Output written to:", OUTPUT_DIR);
}

main();
