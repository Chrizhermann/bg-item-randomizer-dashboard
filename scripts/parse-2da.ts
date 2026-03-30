import { readFileSync } from "node:fs";

// --- Interfaces ---

export interface ItemRow {
  item: string;
  replacement: string;
  source: string;
  tier: string;
  token: string;
  ident: string;
  chance: number;
  comment: string;
}

export interface LocationRow {
  location: number;
  tier: string;
  target: string;
  area: string;
  ident: string;
  chance: number;
  comment: string;
}

export interface GroupRow {
  group: string;
  creature: string;
}

// --- Core parser ---

/**
 * Parse a 2DA file into a 2D array of strings.
 * Splits each line on whitespace, skips blank lines, and skips the header row.
 */
export function parse2DA(filePath: string): string[][] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const rows: string[][] = [];
  let headerSkipped = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const columns = trimmed.split(/\s+/);

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    rows.push(columns);
  }

  return rows;
}

// --- Typed parsers ---

/**
 * Parse an items 2DA file (items/base/bg1.2da or bg2.2da).
 * Rows need at least 7 columns. The 8th column (comment) is optional.
 * Footer lines with fewer columns are skipped.
 */
export function parseItems(filePath: string): ItemRow[] {
  const rows = parse2DA(filePath);
  const items: ItemRow[] = [];

  for (const cols of rows) {
    if (cols.length < 7) continue;

    items.push({
      item: cols[0],
      replacement: cols[1],
      source: cols[2],
      tier: cols[3],
      token: cols[4],
      ident: cols[5],
      chance: Number(cols[6]),
      comment: cols.length > 7 ? cols.slice(7).join(" ") : "",
    });
  }

  return items;
}

/**
 * Parse a locations 2DA file (locations/base/bg1.2da or bg2.2da).
 * Rows need at least 6 columns. The 7th+ columns form the optional comment.
 * Footer lines with fewer columns are skipped.
 */
export function parseLocations(filePath: string): LocationRow[] {
  const rows = parse2DA(filePath);
  const locations: LocationRow[] = [];

  for (const cols of rows) {
    if (cols.length < 6) continue;

    locations.push({
      location: Number(cols[0]),
      tier: cols[1],
      target: cols[2],
      area: cols[3],
      ident: cols[4],
      chance: Number(cols[5]),
      comment: cols.length > 6 ? cols.slice(6).join(" ") : "",
    });
  }

  return locations;
}

/**
 * Parse a groups 2DA file (groups/bg1.2da or bg2.2da).
 * Rows must have exactly 2 columns, and the first column must end with `.flg`.
 */
export function parseGroups(filePath: string): GroupRow[] {
  const rows = parse2DA(filePath);
  const groups: GroupRow[] = [];

  for (const cols of rows) {
    if (cols.length !== 2) continue;
    if (!cols[0].endsWith(".flg")) continue;

    groups.push({
      group: cols[0],
      creature: cols[1],
    });
  }

  return groups;
}
