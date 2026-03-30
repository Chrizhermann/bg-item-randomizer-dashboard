import { openSync, readSync, closeSync, existsSync } from "node:fs";
import { join } from "node:path";

const ITM_HEADER_MIN = 16; // We only need the first 16 bytes
const SIGNATURE = "ITM ";

export interface ITMInfo {
  resref: string;
  unidentifiedNameStrref: number;
  identifiedNameStrref: number;
}

/**
 * Read the name strrefs from an ITM file.
 *
 * ITM header layout (only the fields we need):
 *   0x00  "ITM " signature (4 bytes)
 *   0x04  "V1  " version (4 bytes)
 *   0x08  Unidentified Name strref (4 bytes LE)
 *   0x0C  Identified Name strref (4 bytes LE)
 *
 * Returns null if the file cannot be read or has an invalid signature.
 */
export function readITM(itmPath: string, resref: string): ITMInfo | null {
  let fd: number;
  try {
    fd = openSync(itmPath, "r");
  } catch {
    return null;
  }

  try {
    const buf = Buffer.alloc(ITM_HEADER_MIN);
    const bytesRead = readSync(fd, buf, 0, ITM_HEADER_MIN, 0);

    if (bytesRead < ITM_HEADER_MIN) {
      return null;
    }

    const signature = buf.toString("ascii", 0, 4);
    if (signature !== SIGNATURE) {
      return null;
    }

    const unidentifiedNameStrref = buf.readInt32LE(0x08);
    const identifiedNameStrref = buf.readInt32LE(0x0c);

    return {
      resref,
      unidentifiedNameStrref,
      identifiedNameStrref,
    };
  } finally {
    closeSync(fd);
  }
}

/**
 * Try to find an ITM file in an override directory using case-insensitive
 * matching. Tries the following in order:
 *   1. Exact resref + ".itm"  (e.g. "amul16.itm")
 *   2. UPPERCASE + ".ITM"     (e.g. "AMUL16.ITM")
 *   3. lowercase + ".itm"     (e.g. "amul16.itm")
 *
 * Returns the full path if found, or null if none of the variants exist.
 */
export function findITM(overridePath: string, resref: string): string | null {
  const candidates = [
    join(overridePath, `${resref}.itm`),
    join(overridePath, `${resref.toUpperCase()}.ITM`),
    join(overridePath, `${resref.toLowerCase()}.itm`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
