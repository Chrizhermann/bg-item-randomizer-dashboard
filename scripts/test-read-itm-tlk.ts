import { TLKReader } from "./read-tlk.ts";
import { readITM, findITM } from "./read-itm.ts";

const TLK_PATH =
  "C:/Games/Baldur's Gate II Enhanced Edition modded/lang/en_US/dialog.tlk";
const OVERRIDE_PATH =
  "C:/Games/Baldur's Gate II Enhanced Edition modded/override/";

// Items to test — resref only (no extension)
const TEST_ITEMS = ["amul16", "boot01", "sw1h01", "ring26"];

console.log("=== TLK Reader ===");
const tlk = new TLKReader(TLK_PATH);

// Quick sanity check: strref 0 should be a valid string
const str0 = tlk.getString(0);
console.log(`  strref 0: "${str0}"`);

// Invalid strrefs should return empty
const strNeg = tlk.getString(-1);
const strHuge = tlk.getString(999_999_999);
console.log(
  `  strref -1: "${strNeg}" (expected "")`,
  strNeg === "" ? "PASS" : "FAIL",
);
console.log(
  `  strref 999999999: "${strHuge}" (expected "")`,
  strHuge === "" ? "PASS" : "FAIL",
);

console.log("\n=== ITM Reader ===");
let allPassed = true;

for (const resref of TEST_ITEMS) {
  const itmPath = findITM(OVERRIDE_PATH, resref);
  if (!itmPath) {
    console.log(`  [SKIP] ${resref} — not found in override (may be in BIFF)`);
    continue;
  }

  const info = readITM(itmPath, resref);
  if (!info) {
    console.log(`  [FAIL] ${resref} — could not read ITM file at ${itmPath}`);
    allPassed = false;
    continue;
  }

  const unidentifiedName = tlk.getString(info.unidentifiedNameStrref);
  const identifiedName = tlk.getString(info.identifiedNameStrref);

  console.log(`  [OK] ${resref}:`);
  console.log(
    `    Unidentified: strref ${info.unidentifiedNameStrref} → "${unidentifiedName}"`,
  );
  console.log(
    `    Identified:   strref ${info.identifiedNameStrref} → "${identifiedName}"`,
  );

  // Basic sanity: names should not be empty for real game items
  if (identifiedName === "") {
    console.log(`    [WARN] Identified name is empty`);
  }
}

tlk.close();

console.log("\n=== Case-insensitive findITM test ===");

// Test that findITM can locate files regardless of case
// amul16.itm is stored as lowercase, SW1H01.ITM as uppercase
for (const [searchResref, expectedExists] of [
  ["amul16", true],
  ["AMUL16", true],
  ["SW1H01", true],
  ["sw1h01", true],
] as const) {
  const result = findITM(OVERRIDE_PATH, searchResref);
  const found = result !== null;
  const pass = found === expectedExists;
  console.log(
    `  findITM("${searchResref}"): ${found ? result : "null"} — ${pass ? "PASS" : "FAIL"}`,
  );
  if (!pass) allPassed = false;
}

if (!allPassed) {
  process.exitCode = 1;
}

console.log("\nDone.");
