import { parseItems, parseLocations, parseGroups } from "./parse-2da.ts";

const BASE =
  "C:/Games/Baldur's Gate II Enhanced Edition modded/randomiser/lists";

function testFile<T>(
  label: string,
  parser: (path: string) => T[],
  filePath: string,
  expectedMin: number,
  expectedMax: number,
) {
  const rows = parser(filePath);
  const pass = rows.length >= expectedMin && rows.length <= expectedMax;
  const status = pass ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${label}: ${rows.length} entries (expected ${expectedMin}-${expectedMax})`,
  );
  if (rows.length > 0) {
    console.log("  First:", JSON.stringify(rows[0]));
    console.log("  Last: ", JSON.stringify(rows[rows.length - 1]));
  }
  if (!pass) {
    process.exitCode = 1;
  }
  return rows;
}

console.log("=== BG2 Items ===");
testFile(
  "BG2 items",
  parseItems,
  `${BASE}/items/base/bg2.2da`,
  200,
  350,
);

console.log("\n=== BG1 Items ===");
testFile(
  "BG1 items",
  parseItems,
  `${BASE}/items/base/bg1.2da`,
  100,
  250,
);

console.log("\n=== BG2 Locations ===");
testFile(
  "BG2 locations",
  parseLocations,
  `${BASE}/locations/base/bg2.2da`,
  200,
  350,
);

console.log("\n=== BG1 Locations ===");
testFile(
  "BG1 locations",
  parseLocations,
  `${BASE}/locations/base/bg1.2da`,
  100,
  250,
);

console.log("\n=== BG2 Groups ===");
testFile(
  "BG2 groups",
  parseGroups,
  `${BASE}/groups/bg2.2da`,
  50,
  120,
);

console.log("\n=== BG1 Groups ===");
testFile(
  "BG1 groups",
  parseGroups,
  `${BASE}/groups/bg1.2da`,
  20,
  80,
);

console.log("\nDone.");
