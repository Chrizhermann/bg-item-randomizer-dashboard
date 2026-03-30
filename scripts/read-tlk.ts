import { openSync, readSync, closeSync } from "node:fs";

const HEADER_SIZE = 18;
const ENTRY_SIZE = 26;

const SIGNATURE = "TLK ";
const VERSION = "V1  ";

/**
 * Random-access reader for Infinity Engine TLK (string table) files.
 *
 * The TLK file can be 30+ MB, so we use a file descriptor and readSync
 * to seek directly to the entry and string data we need rather than
 * loading the entire file into memory.
 */
export class TLKReader {
  private fd: number;
  private stringCount: number;
  private stringDataOffset: number;

  constructor(tlkPath: string) {
    this.fd = openSync(tlkPath, "r");

    // Read and validate the 18-byte header
    const header = Buffer.alloc(HEADER_SIZE);
    readSync(this.fd, header, 0, HEADER_SIZE, 0);

    const signature = header.toString("ascii", 0, 4);
    const version = header.toString("ascii", 4, 8);

    if (signature !== SIGNATURE) {
      this.close();
      throw new Error(
        `Invalid TLK signature: expected "${SIGNATURE}", got "${signature}"`,
      );
    }
    if (version !== VERSION) {
      this.close();
      throw new Error(
        `Unsupported TLK version: expected "${VERSION}", got "${version}"`,
      );
    }

    // 0x0A: number of string entries (4 bytes LE)
    this.stringCount = header.readUInt32LE(0x0a);
    // 0x0E: offset to string data section (4 bytes LE)
    this.stringDataOffset = header.readUInt32LE(0x0e);
  }

  /**
   * Look up a string by its strref index.
   *
   * Returns the empty string for strrefs that are out of range or whose
   * entry has no text flag set. Returns the decoded string otherwise.
   * A strref of -1 (0xFFFFFFFF) is the conventional "no string" marker.
   */
  getString(strref: number): string {
    if (strref < 0 || strref >= this.stringCount) {
      return "";
    }

    // Each entry is 26 bytes, starting right after the 18-byte header
    const entryOffset = HEADER_SIZE + strref * ENTRY_SIZE;
    const entry = Buffer.alloc(ENTRY_SIZE);
    readSync(this.fd, entry, 0, ENTRY_SIZE, entryOffset);

    const flags = entry.readUInt16LE(0x00);
    const hasText = (flags & 0x01) !== 0;

    if (!hasText) {
      return "";
    }

    // 0x12: string offset relative to string data section
    const stringOffset = entry.readUInt32LE(0x12);
    // 0x16: string length
    const stringLength = entry.readUInt32LE(0x16);

    if (stringLength === 0) {
      return "";
    }

    const absoluteOffset = this.stringDataOffset + stringOffset;
    const strBuf = Buffer.alloc(stringLength);
    readSync(this.fd, strBuf, 0, stringLength, absoluteOffset);

    return strBuf.toString("utf-8");
  }

  /** Close the underlying file descriptor. */
  close(): void {
    try {
      closeSync(this.fd);
    } catch {
      // Already closed — ignore
    }
  }
}
