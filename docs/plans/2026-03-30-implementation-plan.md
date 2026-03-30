# BG Item Randomizer Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a tracker dashboard for the BG Item Randomiser mod with a React web app and Electron overlay, both sharing one codebase.

**Architecture:** Client-side SPA built with React + Vite + Tailwind. Data extracted at build time from the randomiser mod's 2DA files and game ITM/TLK binary files into static JSON. Electron wraps the same React components in a transparent overlay window. State persisted in localStorage.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Electron, Node.js (for data extraction script)

**Game data source:** `C:/Games/Baldur's Gate II Enhanced Edition modded/`

---

### Task 0: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Step 1: Initialize Vite + React + TypeScript project**

```bash
cd C:/src/private/bg-item-randomizer-dashboard
npm create vite@latest . -- --template react-ts
```

If prompted about existing files, choose to overwrite (only has docs/ and .gitignore).

**Step 2: Install Tailwind CSS**

```bash
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tailwind in Vite**

Update `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Replace `src/index.css` with:
```css
@import "tailwindcss";
```

**Step 4: Verify it works**

```bash
npm run dev
```

Expected: Vite dev server starts, browser shows default React page with Tailwind working.

**Step 5: Clean up scaffolding**

Remove `src/App.css`, boilerplate content from `src/App.tsx`. Replace with:
```tsx
function App() {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      <h1 className="text-2xl p-4">BG Item Randomizer Dashboard</h1>
    </div>
  )
}
export default App
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold React + Vite + Tailwind project"
```

---

### Task 1: Data Extraction Script — 2DA Parser

**Files:**
- Create: `scripts/extract-data.ts`
- Create: `scripts/parse-2da.ts`

**Step 1: Install script dependencies**

```bash
npm install -D tsx
```

(`tsx` allows running TypeScript scripts directly via `npx tsx scripts/extract-data.ts`)

**Step 2: Write 2DA parser**

Create `scripts/parse-2da.ts`:
```ts
import { readFileSync } from 'fs'

export interface ItemRow {
  item: string
  replacement: string
  source: string
  tier: string
  token: string
  ident: string
  chance: number
  comment: string
}

export interface LocationRow {
  location: number
  tier: string
  target: string
  area: string
  ident: string
  chance: number
  comment: string
}

export interface GroupRow {
  group: string
  creature: string
}

/**
 * Parse a 2DA file into rows. 2DA files are tab-delimited with a header row.
 * Blank lines separate tier sections. Lines with fewer columns than the header
 * are footer/metadata lines and should be skipped.
 */
export function parse2DA(filePath: string): string[][] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const rows: string[][] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cols = trimmed.split(/\t+/)
    rows.push(cols)
  }

  return rows
}

export function parseItems(filePath: string): ItemRow[] {
  const rows = parse2DA(filePath)
  const items: ItemRow[] = []

  for (const cols of rows) {
    // Item rows have at least 7 columns (Item, Replacement, Source, Tier, Token, Ident, Chance)
    if (cols.length < 7) continue
    // Skip header row
    if (cols[0] === 'Item') continue

    items.push({
      item: cols[0],
      replacement: cols[1],
      source: cols[2],
      tier: cols[3],
      token: cols[4],
      ident: cols[5],
      chance: parseInt(cols[6], 10),
      comment: cols[7] || '',
    })
  }

  return items
}

export function parseLocations(filePath: string): LocationRow[] {
  const rows = parse2DA(filePath)
  const locations: LocationRow[] = []

  for (const cols of rows) {
    if (cols.length < 6) continue
    if (cols[0] === 'Location') continue

    locations.push({
      location: parseInt(cols[0], 10),
      tier: cols[1],
      target: cols[2],
      area: cols[3],
      ident: cols[4],
      chance: parseInt(cols[5], 10),
      comment: cols[6] || '',
    })
  }

  return locations
}

export function parseGroups(filePath: string): GroupRow[] {
  const rows = parse2DA(filePath)
  const groups: GroupRow[] = []

  for (const cols of rows) {
    if (cols.length < 2) continue
    if (cols[0] === 'Group') continue
    // Group rows are exactly 2 columns: group flag, creature resref
    if (!cols[0].endsWith('.flg')) continue

    groups.push({
      group: cols[0],
      creature: cols[1],
    })
  }

  return groups
}
```

**Step 3: Test the parser manually**

```bash
npx tsx -e "
  const { parseItems, parseLocations, parseGroups } = require('./scripts/parse-2da.ts');
  const items = parseItems('C:/Games/Baldur\\'s Gate II Enhanced Edition modded/randomiser/lists/items/base/bg2.2da');
  console.log('BG2 items:', items.length);
  console.log('First:', items[0]);
  console.log('Last:', items[items.length - 1]);
  const locs = parseLocations('C:/Games/Baldur\\'s Gate II Enhanced Edition modded/randomiser/lists/locations/base/bg2.2da');
  console.log('BG2 locations:', locs.length);
  const groups = parseGroups('C:/Games/Baldur\\'s Gate II Enhanced Edition modded/randomiser/lists/groups/bg2.2da');
  console.log('BG2 groups:', groups.length);
"
```

Expected: Counts printed, no errors. Verify first/last items look correct.

**Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add 2DA file parser for randomiser mod data"
```

---

### Task 2: Data Extraction Script — ITM/TLK Binary Reader

**Files:**
- Create: `scripts/read-tlk.ts`
- Create: `scripts/read-itm.ts`

**Step 1: Write TLK reader**

Create `scripts/read-tlk.ts`:
```ts
import { readFileSync, openSync, readSync, closeSync } from 'fs'

/**
 * TLK file format (Infinity Engine):
 * Header: 18 bytes
 *   0x00: "TLK " signature (4 bytes)
 *   0x04: "V1  " version (4 bytes)
 *   0x08: language ID (2 bytes, little-endian)
 *   0x0A: number of string entries (4 bytes, little-endian)
 *   0x0E: offset to string data section (4 bytes, little-endian)
 *
 * Entry table (26 bytes each, starts at offset 18):
 *   0x00: flags (2 bytes)
 *   0x02: sound resref (8 bytes)
 *   0x0A: volume variance (4 bytes)
 *   0x0E: pitch variance (4 bytes)
 *   0x12: string offset relative to string data section (4 bytes, LE)
 *   0x16: string length (4 bytes, LE)
 */

const HEADER_SIZE = 18
const ENTRY_SIZE = 26

export class TLKReader {
  private fd: number
  private numEntries: number
  private stringDataOffset: number

  constructor(tlkPath: string) {
    this.fd = openSync(tlkPath, 'r')

    const header = Buffer.alloc(HEADER_SIZE)
    readSync(this.fd, header, 0, HEADER_SIZE, 0)

    const sig = header.toString('ascii', 0, 4)
    if (sig !== 'TLK ') {
      throw new Error(`Invalid TLK signature: "${sig}"`)
    }

    this.numEntries = header.readUInt32LE(0x0A)
    this.stringDataOffset = header.readUInt32LE(0x0E)
  }

  getString(strref: number): string {
    if (strref < 0 || strref >= this.numEntries) {
      return `<invalid strref ${strref}>`
    }

    const entryOffset = HEADER_SIZE + strref * ENTRY_SIZE
    const entry = Buffer.alloc(ENTRY_SIZE)
    readSync(this.fd, entry, 0, ENTRY_SIZE, entryOffset)

    const flags = entry.readUInt16LE(0x00)
    if (!(flags & 0x01)) {
      return '' // No text for this entry
    }

    const stringOffset = entry.readUInt32LE(0x12)
    const stringLength = entry.readUInt32LE(0x16)

    if (stringLength === 0) return ''

    const strBuf = Buffer.alloc(stringLength)
    readSync(this.fd, strBuf, 0, stringLength, this.stringDataOffset + stringOffset)

    return strBuf.toString('utf-8')
  }

  close(): void {
    closeSync(this.fd)
  }
}
```

**Step 2: Write ITM reader**

Create `scripts/read-itm.ts`:
```ts
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * ITM file format (relevant offsets):
 *   0x00: "ITM " signature (4 bytes)
 *   0x08: Unidentified Name strref (4 bytes, LE)
 *   0x0C: Identified Name strref (4 bytes, LE)
 *   0x10: Unidentified Description strref (4 bytes, LE)
 *   0x14: Identified Description strref (4 bytes, LE)
 */

export interface ITMInfo {
  resref: string
  unidentifiedNameStrref: number
  identifiedNameStrref: number
}

export function readITM(itmPath: string, resref: string): ITMInfo | null {
  if (!existsSync(itmPath)) return null

  const buf = readFileSync(itmPath)
  if (buf.length < 0x18) return null

  const sig = buf.toString('ascii', 0, 4)
  if (sig !== 'ITM ') return null

  return {
    resref,
    unidentifiedNameStrref: buf.readUInt32LE(0x08),
    identifiedNameStrref: buf.readUInt32LE(0x0C),
  }
}

/**
 * Find an ITM file in the override folder (case-insensitive search).
 * Returns the full path or null if not found.
 */
export function findITM(overridePath: string, resref: string): string | null {
  // Try exact case first
  const exactPath = join(overridePath, `${resref}.itm`)
  if (existsSync(exactPath)) return exactPath

  // Try uppercase
  const upperPath = join(overridePath, `${resref.toUpperCase()}.ITM`)
  if (existsSync(upperPath)) return upperPath

  // Try with .itm extension variations
  const lowerPath = join(overridePath, `${resref.toLowerCase()}.itm`)
  if (existsSync(lowerPath)) return lowerPath

  return null
}
```

**Step 3: Test binary readers manually**

```bash
npx tsx -e "
  const { TLKReader } = require('./scripts/read-tlk.ts');
  const { readITM, findITM } = require('./scripts/read-itm.ts');
  const GAME = 'C:/Games/Baldur\\'s Gate II Enhanced Edition modded';
  const tlk = new TLKReader(GAME + '/lang/en_US/dialog.tlk');
  const itm = readITM(GAME + '/override/amul16.itm', 'amul16');
  console.log('amul16 strrefs:', itm);
  console.log('Unidentified:', tlk.getString(itm.unidentifiedNameStrref));
  console.log('Identified:', tlk.getString(itm.identifiedNameStrref));
  tlk.close();
"
```

Expected: Prints the amulet's display name (e.g., "Amulet" / "Amulet of 5% Magic Resistance" or similar).

**Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add ITM and TLK binary file readers for item name extraction"
```

---

### Task 3: Data Extraction Script — Main Orchestrator

**Files:**
- Create: `scripts/extract-data.ts`
- Create: `src/data/` directory
- Output: `src/data/items.json`, `src/data/locations.json`, `src/data/regions.json`

**Step 1: Write the main extraction script**

Create `scripts/extract-data.ts`:
```ts
import { writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { parseItems, parseLocations, parseGroups, type ItemRow, type LocationRow } from './parse-2da'
import { TLKReader } from './read-tlk'
import { readITM, findITM } from './read-itm'

const GAME_DIR = process.env.BG_GAME_DIR || 'C:/Games/Baldur\'s Gate II Enhanced Edition modded'
const MOD_DIR = join(GAME_DIR, 'randomiser', 'lists')
const OVERRIDE_DIR = join(GAME_DIR, 'override')
const TLK_PATH = join(GAME_DIR, 'lang', 'en_US', 'dialog.tlk')
const OUTPUT_DIR = join(__dirname, '..', 'src', 'data')

interface ExtractedItem {
  id: string           // "tier:token" composite key
  resref: string       // e.g., "amul16"
  tier: string
  token: string
  displayName: string  // from TLK identified name
  unidentifiedName: string // from TLK unidentified name
  originalSource: string
  comment: string
  game: 'bg1' | 'bg2'
}

interface ExtractedLocation {
  id: string           // "tier:location" composite key
  tier: string
  locationIndex: number
  target: string       // container name, .cre, .flg, .bcs, .sto
  area: string         // e.g., "ar0701"
  comment: string
  targetType: 'container' | 'creature' | 'group' | 'script' | 'store' | 'unknown'
  game: 'bg1' | 'bg2'
}

interface Region {
  id: string
  name: string
  areaPattern: string  // regex pattern for matching area codes
  game: 'bg1' | 'bg2'
  sortOrder: number
}

function classifyTarget(target: string): ExtractedLocation['targetType'] {
  if (target.endsWith('.cre')) return 'creature'
  if (target.endsWith('.flg')) return 'group'
  if (target.endsWith('.bcs')) return 'script'
  if (target.endsWith('.sto')) return 'store'
  // Everything else is a container name (e.g., "container5", "chest1", "drawer2")
  if (target.match(/^[a-z]/)) return 'container'
  return 'unknown'
}

function extractItemNames(items: ItemRow[], tlk: TLKReader, game: 'bg1' | 'bg2'): ExtractedItem[] {
  const extracted: ExtractedItem[] = []

  for (const row of items) {
    let displayName = ''
    let unidentifiedName = ''

    const itmPath = findITM(OVERRIDE_DIR, row.item)
    if (itmPath) {
      const itmInfo = readITM(itmPath, row.item)
      if (itmInfo) {
        displayName = tlk.getString(itmInfo.identifiedNameStrref)
        unidentifiedName = tlk.getString(itmInfo.unidentifiedNameStrref)
      }
    }

    // Fall back to comment if no ITM display name found
    if (!displayName) {
      displayName = row.comment || row.item
    }

    extracted.push({
      id: `${row.tier}:${row.token}`,
      resref: row.item,
      tier: row.tier,
      token: row.token,
      displayName,
      unidentifiedName,
      originalSource: row.source,
      comment: row.comment,
      game,
    })
  }

  return extracted
}

function extractLocations(locations: LocationRow[], game: 'bg1' | 'bg2'): ExtractedLocation[] {
  return locations.map(row => ({
    id: `${row.tier}:${row.location}`,
    tier: row.tier,
    locationIndex: row.location,
    target: row.target,
    area: row.area,
    comment: row.comment,
    targetType: classifyTarget(row.target),
    game,
  }))
}

/**
 * Generate initial area-to-region mapping.
 * This is a best-guess grouping that will need manual curation.
 */
function generateRegions(): Region[] {
  // BG2 regions (rough story order)
  const bg2Regions: Region[] = [
    { id: 'bg2-irenicus', name: 'Irenicus\' Dungeon', areaPattern: '^ar0602$|^ar0603$|^ar0604$|^ar0605$', game: 'bg2', sortOrder: 1 },
    { id: 'bg2-promenade', name: 'Waukeen\'s Promenade', areaPattern: '^ar0700$|^ar07', game: 'bg2', sortOrder: 2 },
    { id: 'bg2-slums', name: 'Athkatla - Slums', areaPattern: '^ar0400$|^ar04', game: 'bg2', sortOrder: 3 },
    { id: 'bg2-docks', name: 'Athkatla - Docks', areaPattern: '^ar0300$|^ar03', game: 'bg2', sortOrder: 4 },
    { id: 'bg2-government', name: 'Athkatla - Government', areaPattern: '^ar10', game: 'bg2', sortOrder: 5 },
    { id: 'bg2-graveyard', name: 'Athkatla - Graveyard', areaPattern: '^ar08', game: 'bg2', sortOrder: 6 },
    { id: 'bg2-temple', name: 'Athkatla - Temple District', areaPattern: '^ar02', game: 'bg2', sortOrder: 7 },
    { id: 'bg2-bridge', name: 'Athkatla - Bridge District', areaPattern: '^ar05', game: 'bg2', sortOrder: 8 },
    { id: 'bg2-dearnise', name: 'De\'Arnise Keep', areaPattern: '^ar13', game: 'bg2', sortOrder: 9 },
    { id: 'bg2-sphere', name: 'Planar Sphere', areaPattern: '^ar04[01]', game: 'bg2', sortOrder: 10 },
    { id: 'bg2-umar', name: 'Umar Hills & Temple Ruins', areaPattern: '^ar11', game: 'bg2', sortOrder: 11 },
    { id: 'bg2-trademeet', name: 'Trademeet & Druid Grove', areaPattern: '^ar21|^ar20', game: 'bg2', sortOrder: 12 },
    { id: 'bg2-windspear', name: 'Windspear Hills', areaPattern: '^ar12', game: 'bg2', sortOrder: 13 },
    { id: 'bg2-prison', name: 'Planar Prison', areaPattern: '^ar05[12]', game: 'bg2', sortOrder: 14 },
    { id: 'bg2-spellhold', name: 'Spellhold', areaPattern: '^ar15', game: 'bg2', sortOrder: 15 },
    { id: 'bg2-underdark', name: 'Underdark', areaPattern: '^ar22|^ar23', game: 'bg2', sortOrder: 16 },
    { id: 'bg2-brynnlaw', name: 'Brynnlaw', areaPattern: '^ar16', game: 'bg2', sortOrder: 17 },
    { id: 'bg2-sahuagin', name: 'Sahuagin City', areaPattern: '^ar18[0-5]', game: 'bg2', sortOrder: 18 },
    { id: 'bg2-suldanessellar', name: 'Suldanessellar', areaPattern: '^ar28', game: 'bg2', sortOrder: 19 },
    { id: 'bg2-watchers', name: 'Watcher\'s Keep', areaPattern: '^ar30|^ar31', game: 'bg2', sortOrder: 20 },
    { id: 'bg2-saradush', name: 'Saradush', areaPattern: '^ar50|^ar51', game: 'bg2', sortOrder: 21 },
    { id: 'bg2-abazigal', name: 'Abazigal\'s Lair', areaPattern: '^ar60|^ar61', game: 'bg2', sortOrder: 22 },
    { id: 'bg2-sendai', name: 'Sendai\'s Enclave', areaPattern: '^ar62|^ar63', game: 'bg2', sortOrder: 23 },
    { id: 'bg2-throne', name: 'Throne of Bhaal', areaPattern: '^ar64|^ar65', game: 'bg2', sortOrder: 24 },
    { id: 'bg2-other', name: 'Other BG2 Areas', areaPattern: '^ar', game: 'bg2', sortOrder: 99 },
  ]

  // BG1 regions (EET remapped area codes, rough story order)
  const bg1Regions: Region[] = [
    { id: 'bg1-candlekeep', name: 'Candlekeep', areaPattern: '^ar26|^ar2600', game: 'bg1', sortOrder: 101 },
    { id: 'bg1-fai', name: 'Friendly Arm Inn', areaPattern: '^ar27|^ar2700', game: 'bg1', sortOrder: 102 },
    { id: 'bg1-beregost', name: 'Beregost & Nashkel', areaPattern: '^ar31|^ar32|^ar33|^ar34', game: 'bg1', sortOrder: 103 },
    { id: 'bg1-mines', name: 'Nashkel Mines', areaPattern: '^ar54', game: 'bg1', sortOrder: 104 },
    { id: 'bg1-cloakwood', name: 'Bandit Camp & Cloakwood', areaPattern: '^ar16|^ar17|^ar18|^ar36|^ar37|^ar38', game: 'bg1', sortOrder: 105 },
    { id: 'bg1-baldursgate', name: 'Baldur\'s Gate City', areaPattern: '^ar01|^ar02|^ar03|^ar04|^ar05|^ar06|^ar07|^ar08|^ar09|^ar10', game: 'bg1', sortOrder: 106 },
    { id: 'bg1-durlag', name: 'Durlag\'s Tower', areaPattern: '^ar51|^ar52|^ar53', game: 'bg1', sortOrder: 107 },
    { id: 'bg1-totsc', name: 'Tales of the Sword Coast', areaPattern: '^ar10[0-9]|^ar50', game: 'bg1', sortOrder: 108 },
    { id: 'bg1-other', name: 'Other BG1 Areas', areaPattern: '^ar', game: 'bg1', sortOrder: 199 },
  ]

  return [...bg2Regions, ...bg1Regions]
}

async function main() {
  console.log('Extracting data from:', GAME_DIR)
  console.log()

  // Parse 2DA files
  console.log('Parsing 2DA files...')
  const bg2Items = parseItems(join(MOD_DIR, 'items', 'base', 'bg2.2da'))
  const bg1Items = parseItems(join(MOD_DIR, 'items', 'base', 'bg1.2da'))
  const bg2Locations = parseLocations(join(MOD_DIR, 'locations', 'base', 'bg2.2da'))
  const bg1Locations = parseLocations(join(MOD_DIR, 'locations', 'base', 'bg1.2da'))
  const bg2Groups = parseGroups(join(MOD_DIR, 'groups', 'bg2.2da'))
  const bg1Groups = parseGroups(join(MOD_DIR, 'groups', 'bg1.2da'))

  console.log(`  BG2: ${bg2Items.length} items, ${bg2Locations.length} locations, ${bg2Groups.length} group entries`)
  console.log(`  BG1: ${bg1Items.length} items, ${bg1Locations.length} locations, ${bg1Groups.length} group entries`)

  // Read TLK for item names
  console.log('Reading TLK string table...')
  const tlk = new TLKReader(TLK_PATH)

  // Extract item display names
  console.log('Extracting item display names from ITM files...')
  const extractedBG2Items = extractItemNames(bg2Items, tlk, 'bg2')
  const extractedBG1Items = extractItemNames(bg1Items, tlk, 'bg1')
  const allItems = [...extractedBG2Items, ...extractedBG1Items]

  const namesFound = allItems.filter(i => i.displayName && i.displayName !== i.resref).length
  console.log(`  Found display names for ${namesFound}/${allItems.length} items`)

  tlk.close()

  // Extract locations
  console.log('Extracting locations...')
  const extractedBG2Locs = extractLocations(bg2Locations, 'bg2')
  const extractedBG1Locs = extractLocations(bg1Locations, 'bg1')
  const allLocations = [...extractedBG2Locs, ...extractedBG1Locs]

  // Generate regions
  console.log('Generating initial region mapping...')
  const regions = generateRegions()

  // Write output
  mkdirSync(OUTPUT_DIR, { recursive: true })

  writeFileSync(join(OUTPUT_DIR, 'items.json'), JSON.stringify(allItems, null, 2))
  console.log(`  Wrote ${allItems.length} items to src/data/items.json`)

  writeFileSync(join(OUTPUT_DIR, 'locations.json'), JSON.stringify(allLocations, null, 2))
  console.log(`  Wrote ${allLocations.length} locations to src/data/locations.json`)

  const groupMap: Record<string, string[]> = {}
  for (const g of [...bg2Groups, ...bg1Groups]) {
    if (!groupMap[g.group]) groupMap[g.group] = []
    groupMap[g.group].push(g.creature)
  }
  writeFileSync(join(OUTPUT_DIR, 'groups.json'), JSON.stringify(groupMap, null, 2))
  console.log(`  Wrote ${Object.keys(groupMap).length} groups to src/data/groups.json`)

  writeFileSync(join(OUTPUT_DIR, 'regions.json'), JSON.stringify(regions, null, 2))
  console.log(`  Wrote ${regions.length} regions to src/data/regions.json`)

  console.log('\nDone!')
}

main().catch(console.error)
```

**Step 2: Add npm script to package.json**

Add to `scripts` in `package.json`:
```json
"extract-data": "tsx scripts/extract-data.ts"
```

**Step 3: Run extraction and verify**

```bash
npm run extract-data
```

Expected: Console output showing counts, JSON files written to `src/data/`.

**Step 4: Spot-check the output**

Open `src/data/items.json` and verify a few known items have correct display names. Open `src/data/locations.json` and verify location data looks correct.

**Step 5: Commit**

```bash
git add scripts/ src/data/ package.json
git commit -m "feat: add data extraction pipeline — parse 2DA/ITM/TLK into static JSON"
```

---

### Task 4: TypeScript Types & State Management

**Files:**
- Create: `src/types.ts`
- Create: `src/store.ts`

**Step 1: Define shared types**

Create `src/types.ts`:
```ts
export interface Item {
  id: string           // "tier:token"
  resref: string
  tier: string
  token: string
  displayName: string
  unidentifiedName: string
  originalSource: string
  comment: string
  game: 'bg1' | 'bg2'
}

export interface Location {
  id: string           // "tier:location"
  tier: string
  locationIndex: number
  target: string
  area: string
  comment: string
  targetType: 'container' | 'creature' | 'group' | 'script' | 'store' | 'unknown'
  game: 'bg1' | 'bg2'
}

export interface Region {
  id: string
  name: string
  areaPattern: string
  game: 'bg1' | 'bg2'
  sortOrder: number
}

export type GroupBy = 'tier' | 'area' | 'status'

/** Per-location tracking state (user's progress) */
export interface LocationState {
  checked: boolean
  assignedItemId: string | null  // Item.id of found item
  note: string
}

/** Full session state */
export interface SessionState {
  name: string
  createdAt: string
  locationStates: Record<string, LocationState>  // keyed by Location.id
}
```

**Step 2: Write localStorage-based store**

Create `src/store.ts`:
```ts
import { useState, useCallback } from 'react'
import type { SessionState, LocationState } from './types'

const STORAGE_KEY = 'bg-randomizer-sessions'
const ACTIVE_SESSION_KEY = 'bg-randomizer-active-session'

function loadSessions(): Record<string, SessionState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSessions(sessions: Record<string, SessionState>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function getActiveSessionName(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

function setActiveSessionName(name: string): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, name)
}

const defaultLocationState: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

export function useTrackerStore() {
  const [sessions, setSessions] = useState<Record<string, SessionState>>(loadSessions)
  const [activeSessionName, setActiveSession] = useState<string | null>(getActiveSessionName)

  const activeSession = activeSessionName ? sessions[activeSessionName] ?? null : null

  const createSession = useCallback((name: string) => {
    const newSession: SessionState = {
      name,
      createdAt: new Date().toISOString(),
      locationStates: {},
    }
    const updated = { ...sessions, [name]: newSession }
    setSessions(updated)
    saveSessions(updated)
    setActiveSession(name)
    setActiveSessionName(name)
  }, [sessions])

  const switchSession = useCallback((name: string) => {
    setActiveSession(name)
    setActiveSessionName(name)
  }, [])

  const deleteSession = useCallback((name: string) => {
    const updated = { ...sessions }
    delete updated[name]
    setSessions(updated)
    saveSessions(updated)
    if (activeSessionName === name) {
      const remaining = Object.keys(updated)
      const next = remaining.length > 0 ? remaining[0] : null
      setActiveSession(next)
      if (next) setActiveSessionName(next)
    }
  }, [sessions, activeSessionName])

  const getLocationState = useCallback((locationId: string): LocationState => {
    return activeSession?.locationStates[locationId] ?? defaultLocationState
  }, [activeSession])

  const updateLocation = useCallback((locationId: string, updates: Partial<LocationState>) => {
    if (!activeSessionName || !sessions[activeSessionName]) return

    const session = sessions[activeSessionName]
    const current = session.locationStates[locationId] ?? defaultLocationState
    const updatedState = { ...current, ...updates }

    const updatedSession: SessionState = {
      ...session,
      locationStates: {
        ...session.locationStates,
        [locationId]: updatedState,
      },
    }

    const updatedSessions = { ...sessions, [activeSessionName]: updatedSession }
    setSessions(updatedSessions)
    saveSessions(updatedSessions)
  }, [sessions, activeSessionName])

  const toggleChecked = useCallback((locationId: string) => {
    const current = getLocationState(locationId)
    updateLocation(locationId, { checked: !current.checked })
  }, [getLocationState, updateLocation])

  const assignItem = useCallback((locationId: string, itemId: string | null) => {
    updateLocation(locationId, { assignedItemId: itemId })
  }, [updateLocation])

  const setNote = useCallback((locationId: string, note: string) => {
    updateLocation(locationId, { note })
  }, [updateLocation])

  const exportSession = useCallback((): string | null => {
    if (!activeSession) return null
    return JSON.stringify(activeSession, null, 2)
  }, [activeSession])

  const importSession = useCallback((json: string) => {
    const imported: SessionState = JSON.parse(json)
    const updated = { ...sessions, [imported.name]: imported }
    setSessions(updated)
    saveSessions(updated)
    setActiveSession(imported.name)
    setActiveSessionName(imported.name)
  }, [sessions])

  return {
    sessions,
    activeSession,
    activeSessionName,
    createSession,
    switchSession,
    deleteSession,
    getLocationState,
    toggleChecked,
    assignItem,
    setNote,
    exportSession,
    importSession,
  }
}
```

**Step 3: Commit**

```bash
git add src/types.ts src/store.ts
git commit -m "feat: add TypeScript types and localStorage-based tracker state"
```

---

### Task 5: Web App — Data Loading & Grouping Logic

**Files:**
- Create: `src/data-loader.ts`
- Create: `src/grouping.ts`

**Step 1: Create data loader**

Create `src/data-loader.ts`:
```ts
import type { Item, Location, Region } from './types'
import itemsData from './data/items.json'
import locationsData from './data/locations.json'
import regionsData from './data/regions.json'
import groupsData from './data/groups.json'

export const items: Item[] = itemsData as Item[]
export const locations: Location[] = locationsData as Location[]
export const regions: Region[] = regionsData as Region[]
export const groups: Record<string, string[]> = groupsData as Record<string, string[]>

// Indexes for fast lookup
export const itemById = new Map<string, Item>(items.map(i => [i.id, i]))
export const itemsByTier = new Map<string, Item[]>()
for (const item of items) {
  const list = itemsByTier.get(item.tier) ?? []
  list.push(item)
  itemsByTier.set(item.tier, list)
}

export const locationsByTier = new Map<string, Location[]>()
for (const loc of locations) {
  const list = locationsByTier.get(loc.tier) ?? []
  list.push(loc)
  locationsByTier.set(loc.tier, list)
}
```

**Step 2: Create grouping logic**

Create `src/grouping.ts`:
```ts
import type { Location, Region, GroupBy, LocationState } from './types'
import { regions } from './data-loader'

export interface LocationGroup {
  id: string
  name: string
  sortOrder: number
  locations: Location[]
}

/** Human-readable tier names */
const TIER_NAMES: Record<string, string> = {
  '1': 'BG2 SoA — Tier 1 (Early)',
  '2': 'BG2 SoA — Tier 2',
  '3': 'BG2 SoA — Tier 3',
  '4': 'BG2 SoA — Tier 4',
  '5': 'BG2 SoA — Tier 5',
  '6': 'BG2 SoA — Tier 6',
  '7': 'BG2 SoA — Tier 7 (Late)',
  '10': 'BG2 ToB — Tier 10',
  '11': 'BG2 ToB — Tier 11',
  '12': 'BG2 ToB — Tier 12',
  '13': 'BG2 ToB — Tier 13',
  '24': 'BG1 — Tier 24 (Early)',
  '25': 'BG1 — Tier 25',
  '26': 'BG1 — Tier 26',
  '27': 'BG1 — Tier 27',
  '28': 'BG1 — Tier 28 (Late)',
  '29': 'BG1 TotSC — Tier 29',
  '30': 'BG1 TotSC — Tier 30',
  '31': 'BG1 TotSC — Tier 31',
  's4': 'Scrolls — Level 4',
  's5': 'Scrolls — Level 5',
  's6': 'Scrolls — Level 6',
  's7': 'Scrolls — Level 7',
  's8': 'Scrolls — Level 8',
  's9': 'Scrolls — Level 9',
  'sa': 'BG1 Scrolls — Level 1',
  'sb': 'BG1 Scrolls — Level 2',
  'sc': 'BG1 Scrolls — Level 3',
  'sd': 'BG1 Scrolls — Level 4',
  'se': 'BG1 Scrolls — Level 5',
  'fa': 'Flail of Ages Heads',
}

function tierSortOrder(tier: string): number {
  // BG2 SoA first, then ToB, then BG1, then scrolls, then special
  const order: Record<string, number> = {
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '10': 10, '11': 11, '12': 12, '13': 13,
    '24': 24, '25': 25, '26': 26, '27': 27, '28': 28, '29': 29, '30': 30, '31': 31,
    's4': 104, 's5': 105, 's6': 106, 's7': 107, 's8': 108, 's9': 109,
    'sa': 201, 'sb': 202, 'sc': 203, 'sd': 204, 'se': 205,
    'fa': 300,
  }
  return order[tier] ?? 999
}

export function groupLocations(
  allLocations: Location[],
  groupBy: GroupBy,
  locationStates: Record<string, LocationState>,
): LocationGroup[] {
  if (groupBy === 'tier') {
    return groupByTier(allLocations)
  } else if (groupBy === 'area') {
    return groupByArea(allLocations)
  } else {
    return groupByStatus(allLocations, locationStates)
  }
}

function groupByTier(locations: Location[]): LocationGroup[] {
  const groups = new Map<string, Location[]>()

  for (const loc of locations) {
    const list = groups.get(loc.tier) ?? []
    list.push(loc)
    groups.set(loc.tier, list)
  }

  return Array.from(groups.entries())
    .map(([tier, locs]) => ({
      id: `tier-${tier}`,
      name: TIER_NAMES[tier] ?? `Tier ${tier}`,
      sortOrder: tierSortOrder(tier),
      locations: locs,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function groupByArea(locations: Location[]): LocationGroup[] {
  const grouped = new Map<string, Location[]>()
  const regionLookup = new Map<string, Region>()

  // Build region lookup: assign each location to the first matching region
  for (const loc of locations) {
    let matched = false
    for (const region of regions) {
      if (loc.game === region.game && new RegExp(region.areaPattern).test(loc.area)) {
        const list = grouped.get(region.id) ?? []
        list.push(loc)
        grouped.set(region.id, list)
        regionLookup.set(region.id, region)
        matched = true
        break
      }
    }
    if (!matched) {
      const fallbackId = `${loc.game}-other`
      const list = grouped.get(fallbackId) ?? []
      list.push(loc)
      grouped.set(fallbackId, list)
    }
  }

  return Array.from(grouped.entries())
    .map(([regionId, locs]) => {
      const region = regionLookup.get(regionId)
      return {
        id: regionId,
        name: region?.name ?? regionId,
        sortOrder: region?.sortOrder ?? 999,
        locations: locs,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function groupByStatus(
  locations: Location[],
  locationStates: Record<string, LocationState>,
): LocationGroup[] {
  const unchecked: Location[] = []
  const checked: Location[] = []

  for (const loc of locations) {
    const state = locationStates[loc.id]
    if (state?.checked) {
      checked.push(loc)
    } else {
      unchecked.push(loc)
    }
  }

  return [
    { id: 'unchecked', name: 'Unchecked', sortOrder: 1, locations: unchecked },
    { id: 'checked', name: 'Checked', sortOrder: 2, locations: checked },
  ]
}
```

**Step 3: Commit**

```bash
git add src/data-loader.ts src/grouping.ts
git commit -m "feat: add data loading indexes and location grouping logic"
```

---

### Task 6: Web App — Main Layout & Header

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/Header.tsx`
- Create: `src/components/SessionManager.tsx`

**Step 1: Build Header component**

Create `src/components/Header.tsx`:
```tsx
import type { GroupBy } from '../types'

interface HeaderProps {
  totalLocations: number
  checkedCount: number
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  sessionName: string | null
  onManageSessions: () => void
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'tier', label: 'Tier' },
  { value: 'area', label: 'Area' },
  { value: 'status', label: 'Status' },
]

export function Header({ totalLocations, checkedCount, groupBy, onGroupByChange, sessionName, onManageSessions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-stone-800 border-b border-stone-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-amber-400">BG Item Randomizer</h1>
        <span className="text-sm text-stone-400">
          {checkedCount}/{totalLocations} checked
        </span>
        <div className="w-32 h-2 bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${totalLocations > 0 ? (checkedCount / totalLocations) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex rounded-md border border-stone-600 overflow-hidden">
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onGroupByChange(opt.value)}
              className={`px-3 py-1 text-sm transition-colors ${
                groupBy === opt.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={onManageSessions}
          className="text-sm text-stone-400 hover:text-stone-200 border border-stone-600 rounded px-2 py-1"
        >
          {sessionName ?? 'No session'}
        </button>
      </div>
    </header>
  )
}
```

**Step 2: Build SessionManager component**

Create `src/components/SessionManager.tsx`:
```tsx
import { useState } from 'react'
import type { SessionState } from '../types'

interface SessionManagerProps {
  sessions: Record<string, SessionState>
  activeSessionName: string | null
  onCreateSession: (name: string) => void
  onSwitchSession: (name: string) => void
  onDeleteSession: (name: string) => void
  onExport: () => string | null
  onImport: (json: string) => void
  onClose: () => void
}

export function SessionManager({
  sessions, activeSessionName, onCreateSession, onSwitchSession,
  onDeleteSession, onExport, onImport, onClose,
}: SessionManagerProps) {
  const [newName, setNewName] = useState('')

  const handleCreate = () => {
    const name = newName.trim()
    if (name) {
      onCreateSession(name)
      setNewName('')
    }
  }

  const handleExport = () => {
    const json = onExport()
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeSessionName}-tracker.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        file.text().then(onImport)
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-stone-800 border border-stone-600 rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-amber-400 mb-4">Sessions</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="New session name..."
            className="flex-1 bg-stone-700 border border-stone-600 rounded px-3 py-1 text-sm text-stone-100 placeholder:text-stone-500"
          />
          <button
            onClick={handleCreate}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-sm"
          >
            Create
          </button>
        </div>

        <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {Object.values(sessions).map(session => (
            <div
              key={session.name}
              className={`flex items-center justify-between px-3 py-2 rounded text-sm cursor-pointer ${
                session.name === activeSessionName
                  ? 'bg-amber-600/20 border border-amber-600/40'
                  : 'hover:bg-stone-700'
              }`}
              onClick={() => onSwitchSession(session.name)}
            >
              <span className="text-stone-200">{session.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.name) }}
                className="text-stone-500 hover:text-red-400 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
          {Object.keys(sessions).length === 0 && (
            <p className="text-stone-500 text-sm text-center py-4">No sessions yet. Create one to start tracking.</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-stone-700 pt-3">
          <button onClick={handleExport} className="text-sm text-stone-400 hover:text-stone-200">Export</button>
          <button onClick={handleImport} className="text-sm text-stone-400 hover:text-stone-200">Import</button>
          <div className="flex-1" />
          <button onClick={onClose} className="text-sm text-stone-400 hover:text-stone-200">Close</button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Wire up App.tsx**

Replace `src/App.tsx`:
```tsx
import { useState } from 'react'
import { Header } from './components/Header'
import { SessionManager } from './components/SessionManager'
import { LocationList } from './components/LocationList'
import { useTrackerStore } from './store'
import { locations } from './data-loader'
import type { GroupBy } from './types'

function App() {
  const store = useTrackerStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('tier')
  const [showSessionManager, setShowSessionManager] = useState(!store.activeSession)

  const checkedCount = store.activeSession
    ? Object.values(store.activeSession.locationStates).filter(s => s.checked).length
    : 0

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      <Header
        totalLocations={locations.length}
        checkedCount={checkedCount}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sessionName={store.activeSessionName}
        onManageSessions={() => setShowSessionManager(true)}
      />

      {store.activeSession ? (
        <LocationList
          groupBy={groupBy}
          locationStates={store.activeSession.locationStates}
          onToggleChecked={store.toggleChecked}
          onAssignItem={store.assignItem}
          onSetNote={store.setNote}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-stone-500">
          <p className="text-lg mb-2">No active session</p>
          <button
            onClick={() => setShowSessionManager(true)}
            className="text-amber-400 hover:text-amber-300"
          >
            Create or select a session to start tracking
          </button>
        </div>
      )}

      {showSessionManager && (
        <SessionManager
          sessions={store.sessions}
          activeSessionName={store.activeSessionName}
          onCreateSession={store.createSession}
          onSwitchSession={store.switchSession}
          onDeleteSession={store.deleteSession}
          onExport={store.exportSession}
          onImport={store.importSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}
    </div>
  )
}

export default App
```

**Step 4: Verify it compiles**

```bash
npm run dev
```

Expected: App shows header with progress bar and grouping toggle. Session manager opens on first load.

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: add header, session manager, and app layout shell"
```

---

### Task 7: Web App — Location List & Location Row

**Files:**
- Create: `src/components/LocationList.tsx`
- Create: `src/components/LocationRow.tsx`
- Create: `src/components/GroupHeader.tsx`

**Step 1: Build GroupHeader**

Create `src/components/GroupHeader.tsx`:
```tsx
interface GroupHeaderProps {
  name: string
  checkedCount: number
  totalCount: number
  isExpanded: boolean
  onToggle: () => void
}

export function GroupHeader({ name, checkedCount, totalCount, isExpanded, onToggle }: GroupHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-2 bg-stone-800 hover:bg-stone-750 border-b border-stone-700 sticky top-[57px] z-[5]"
    >
      <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
        &#9654;
      </span>
      <span className="font-medium text-amber-300">{name}</span>
      <span className="text-sm text-stone-500">
        {checkedCount}/{totalCount}
      </span>
      {checkedCount === totalCount && totalCount > 0 && (
        <span className="text-xs text-green-500 ml-1">Complete</span>
      )}
    </button>
  )
}
```

**Step 2: Build LocationRow**

Create `src/components/LocationRow.tsx`:
```tsx
import { useState } from 'react'
import type { Location, LocationState } from '../types'
import { itemById } from '../data-loader'
import { ItemPopup } from './ItemPopup'

interface LocationRowProps {
  location: Location
  state: LocationState
  onToggleChecked: () => void
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  showCodes: boolean
}

export function LocationRow({ location, state, onToggleChecked, onAssignItem, onSetNote, showCodes }: LocationRowProps) {
  const [showPopup, setShowPopup] = useState(false)
  const assignedItem = state.assignedItemId ? itemById.get(state.assignedItemId) : null

  const description = location.comment || `${location.target} in ${location.area}`

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 border-b border-stone-800 hover:bg-stone-800/50 ${
        state.checked ? 'opacity-60' : ''
      }`}
      onContextMenu={(e) => { e.preventDefault(); setShowPopup(true) }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={state.checked}
        onChange={onToggleChecked}
        className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
      />

      {/* Location description */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${state.checked ? 'line-through text-stone-500' : 'text-stone-200'}`}>
          {description}
        </span>
        {showCodes && (
          <span className="ml-2 text-xs text-stone-600 font-mono">
            {location.area}/{location.target}
          </span>
        )}
      </div>

      {/* Assigned item badge */}
      {assignedItem && (
        <span className="text-xs bg-amber-600/20 text-amber-300 border border-amber-600/30 rounded px-2 py-0.5 whitespace-nowrap">
          {assignedItem.displayName}
        </span>
      )}

      {/* Note indicator */}
      {state.note && (
        <span className="text-xs text-stone-500" title={state.note}>
          &#128221;
        </span>
      )}

      {/* Assign button */}
      <button
        onClick={() => setShowPopup(true)}
        className="text-stone-600 hover:text-amber-400 text-sm shrink-0"
        title="Assign item / add note"
      >
        +
      </button>

      {/* Item assignment popup */}
      {showPopup && (
        <ItemPopup
          tier={location.tier}
          currentItemId={state.assignedItemId}
          currentNote={state.note}
          onAssignItem={onAssignItem}
          onSetNote={onSetNote}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}
```

**Step 3: Build LocationList**

Create `src/components/LocationList.tsx`:
```tsx
import { useState, useMemo } from 'react'
import type { GroupBy, LocationState } from '../types'
import { locations } from '../data-loader'
import { groupLocations } from '../grouping'
import { GroupHeader } from './GroupHeader'
import { LocationRow } from './LocationRow'

interface LocationListProps {
  groupBy: GroupBy
  locationStates: Record<string, LocationState>
  onToggleChecked: (locationId: string) => void
  onAssignItem: (locationId: string, itemId: string | null) => void
  onSetNote: (locationId: string, note: string) => void
}

export function LocationList({ groupBy, locationStates, onToggleChecked, onAssignItem, onSetNote }: LocationListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showCodes, setShowCodes] = useState(true)

  const groups = useMemo(
    () => groupLocations(locations, groupBy, locationStates),
    [groupBy, locationStates],
  )

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const expandAll = () => setExpandedGroups(new Set(groups.map(g => g.id)))
  const collapseAll = () => setExpandedGroups(new Set())

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-stone-500 border-b border-stone-800">
        <button onClick={expandAll} className="hover:text-stone-300">Expand all</button>
        <span>/</span>
        <button onClick={collapseAll} className="hover:text-stone-300">Collapse all</button>
        <div className="flex-1" />
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showCodes}
            onChange={e => setShowCodes(e.target.checked)}
            className="accent-amber-500"
          />
          Show codes
        </label>
      </div>

      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.id)
        const checkedCount = group.locations.filter(
          loc => locationStates[loc.id]?.checked
        ).length

        return (
          <div key={group.id}>
            <GroupHeader
              name={group.name}
              checkedCount={checkedCount}
              totalCount={group.locations.length}
              isExpanded={isExpanded}
              onToggle={() => toggleGroup(group.id)}
            />
            {isExpanded && group.locations.map(loc => (
              <LocationRow
                key={loc.id}
                location={loc}
                state={locationStates[loc.id] ?? { checked: false, assignedItemId: null, note: '' }}
                onToggleChecked={() => onToggleChecked(loc.id)}
                onAssignItem={(itemId) => onAssignItem(loc.id, itemId)}
                onSetNote={(note) => onSetNote(loc.id, note)}
                showCodes={showCodes}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 4: Verify in browser**

```bash
npm run dev
```

Expected: Location list renders with collapsible tier groups. Clicking checkboxes toggles checked state.

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add location list with collapsible groups and location rows"
```

---

### Task 8: Web App — Item Assignment Popup

**Files:**
- Create: `src/components/ItemPopup.tsx`

**Step 1: Build the popup**

Create `src/components/ItemPopup.tsx`:
```tsx
import { useState } from 'react'
import type { Item } from '../types'
import { itemsByTier } from '../data-loader'

interface ItemPopupProps {
  tier: string
  currentItemId: string | null
  currentNote: string
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  onClose: () => void
}

export function ItemPopup({ tier, currentItemId, currentNote, onAssignItem, onSetNote, onClose }: ItemPopupProps) {
  const [note, setNote] = useState(currentNote)
  const [search, setSearch] = useState('')
  const tierItems = itemsByTier.get(tier) ?? []

  const filteredItems = search
    ? tierItems.filter(item =>
        item.displayName.toLowerCase().includes(search.toLowerCase()) ||
        item.resref.toLowerCase().includes(search.toLowerCase())
      )
    : tierItems

  const handleAssign = (item: Item) => {
    if (currentItemId === item.id) {
      onAssignItem(null) // Unassign
    } else {
      onAssignItem(item.id)
    }
  }

  const handleNoteBlur = () => {
    if (note !== currentNote) {
      onSetNote(note)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-stone-800 border border-stone-600 rounded-lg w-96 max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
          <h3 className="text-sm font-bold text-amber-400">Assign Item (Tier {tier})</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">&times;</button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-stone-700">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-1 text-sm text-stone-100 placeholder:text-stone-500"
            autoFocus
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {/* Unassign option */}
          {currentItemId && (
            <button
              onClick={() => onAssignItem(null)}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-stone-700 border-b border-stone-800"
            >
              Clear assignment
            </button>
          )}

          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleAssign(item)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-700 border-b border-stone-800 ${
                currentItemId === item.id ? 'bg-amber-600/20 text-amber-300' : 'text-stone-200'
              }`}
            >
              <span>{item.displayName}</span>
              <span className="ml-2 text-xs text-stone-500 font-mono">{item.resref}</span>
            </button>
          ))}

          {filteredItems.length === 0 && (
            <p className="text-center text-stone-500 text-sm py-4">No items found</p>
          )}
        </div>

        {/* Note input */}
        <div className="px-4 py-3 border-t border-stone-700">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add a note..."
            rows={2}
            className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify popup works**

```bash
npm run dev
```

Expected: Clicking "+" on a location row opens the popup. Items are filtered by tier. Clicking an item assigns it and shows the badge on the row. Notes persist.

**Step 3: Commit**

```bash
git add src/components/ItemPopup.tsx
git commit -m "feat: add tier-filtered item assignment popup with search and notes"
```

---

### Task 9: Electron Overlay — Setup

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Modify: `package.json`
- Modify: `vite.config.ts`

**Step 1: Install Electron dependencies**

```bash
npm install -D electron electron-builder vite-plugin-electron vite-plugin-electron-renderer
```

**Step 2: Create Electron main process**

Create `electron/main.ts`:
```ts
import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let isVisible = true

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 380,
    height: height - 100,
    x: width - 400,
    y: 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  // Set click-through when not hovering (optional — can be toggled)
  mainWindow.setIgnoreMouseEvents(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '?mode=overlay')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'), {
      search: 'mode=overlay',
    })
  }
}

app.whenReady().then(() => {
  createWindow()

  // F9 to toggle visibility
  globalShortcut.register('F9', () => {
    if (!mainWindow) return
    if (isVisible) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
    isVisible = !isVisible
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
```

**Step 3: Create preload script**

Create `electron/preload.ts`:
```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay: true,
})
```

**Step 4: Update vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart({ reload }) {
          reload()
        },
      },
    ]),
    renderer(),
  ],
})
```

**Step 5: Update package.json**

Add to `package.json`:
```json
"main": "dist-electron/main.js",
"scripts": {
  "overlay": "vite --mode electron",
  "build:overlay": "vite build && electron-builder"
}
```

**Step 6: Verify Electron starts**

```bash
npm run dev
```

Expected: Both web app and Electron window launch. The Electron window is transparent and always on top.

**Step 7: Commit**

```bash
git add electron/ vite.config.ts package.json
git commit -m "feat: add Electron overlay shell with transparent always-on-top window"
```

---

### Task 10: Electron Overlay — Compact View

**Files:**
- Create: `src/components/OverlayView.tsx`
- Create: `src/components/OverlayLocationRow.tsx`
- Modify: `src/App.tsx`

**Step 1: Create overlay detection hook**

Add to `src/App.tsx` (at top):
```ts
function useIsOverlay(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.get('mode') === 'overlay' || !!(window as any).electronAPI?.isOverlay
}
```

**Step 2: Build OverlayLocationRow**

Create `src/components/OverlayLocationRow.tsx`:
```tsx
import type { Location, LocationState } from '../types'
import { itemById } from '../data-loader'

interface OverlayLocationRowProps {
  location: Location
  state: LocationState
  onToggleChecked: () => void
}

export function OverlayLocationRow({ location, state, onToggleChecked }: OverlayLocationRowProps) {
  const assignedItem = state.assignedItemId ? itemById.get(state.assignedItemId) : null
  const description = location.comment || location.target

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-white/5 ${
        state.checked ? 'opacity-40' : ''
      }`}
      onClick={onToggleChecked}
    >
      <span className={`${state.checked ? 'text-green-400' : 'text-stone-500'}`}>
        {state.checked ? '✓' : '○'}
      </span>
      <span className={`flex-1 ${state.checked ? 'line-through text-stone-500' : 'text-stone-200'}`}>
        {description}
      </span>
      {assignedItem && (
        <span className="text-amber-400 truncate max-w-[120px]">
          {assignedItem.displayName}
        </span>
      )}
    </div>
  )
}
```

**Step 3: Build OverlayView**

Create `src/components/OverlayView.tsx`:
```tsx
import { useState, useMemo } from 'react'
import type { GroupBy, LocationState } from '../types'
import { locations } from '../data-loader'
import { groupLocations } from '../grouping'
import { OverlayLocationRow } from './OverlayLocationRow'

interface OverlayViewProps {
  locationStates: Record<string, LocationState>
  onToggleChecked: (locationId: string) => void
}

export function OverlayView({ locationStates, onToggleChecked }: OverlayViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const groupBy: GroupBy = 'tier'

  const groups = useMemo(
    () => groupLocations(locations, groupBy, locationStates),
    [locationStates],
  )

  const checkedCount = Object.values(locationStates).filter(s => s.checked).length

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="h-screen overflow-y-auto bg-black/70 text-stone-100 select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Title bar / drag handle */}
      <div className="sticky top-0 z-10 bg-black/80 px-3 py-2 flex items-center justify-between border-b border-stone-700/50">
        <span className="text-xs font-bold text-amber-400">BG Randomizer</span>
        <span className="text-xs text-stone-500">{checkedCount}/{locations.length}</span>
      </div>

      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {groups.map(group => {
          const isExpanded = expandedGroups.has(group.id)
          const groupChecked = group.locations.filter(l => locationStates[l.id]?.checked).length

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs bg-stone-900/50 hover:bg-stone-800/50 border-b border-stone-800/50"
              >
                <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                <span className="text-amber-300 font-medium">{group.name}</span>
                <span className="text-stone-600">{groupChecked}/{group.locations.length}</span>
              </button>
              {isExpanded && group.locations.map(loc => (
                <OverlayLocationRow
                  key={loc.id}
                  location={loc}
                  state={locationStates[loc.id] ?? { checked: false, assignedItemId: null, note: '' }}
                  onToggleChecked={() => onToggleChecked(loc.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: Update App.tsx to route between views**

In `App.tsx`, conditionally render `OverlayView` when in overlay mode:
```tsx
const isOverlay = useIsOverlay()

if (isOverlay) {
  return (
    <OverlayView
      locationStates={store.activeSession?.locationStates ?? {}}
      onToggleChecked={store.toggleChecked}
    />
  )
}

// ... rest of existing App render
```

**Step 5: Verify overlay mode**

Visit `http://localhost:5173/?mode=overlay` in the browser to test the compact view.

**Step 6: Commit**

```bash
git add src/components/OverlayView.tsx src/components/OverlayLocationRow.tsx src/App.tsx
git commit -m "feat: add compact overlay view for Electron with collapsible groups"
```

---

### Task 11: Polish & Final Integration

**Files:**
- Modify: various for bug fixes discovered during testing

**Step 1: Add CLAUDE.md for the project**

Create `CLAUDE.md`:
```markdown
# BG Item Randomizer Dashboard

## Quick Start
- `npm run dev` — Start web app dev server
- `npm run extract-data` — Regenerate data from game files (requires game installed)
- `npm run build` — Production build

## Architecture
- React + Vite + Tailwind CSS web app
- Electron overlay (shares React components)
- Static JSON data extracted from BG:EE randomiser mod 2DA/ITM/TLK files
- localStorage for tracker state

## Key Directories
- `scripts/` — Build-time data extraction from game files
- `src/data/` — Generated JSON (committed, manually curable)
- `src/components/` — React components (shared between web app and overlay)
- `electron/` — Electron main process

## Game Data Source
Default: `C:/Games/Baldur's Gate II Enhanced Edition modded/`
Override with `BG_GAME_DIR` env variable.
```

**Step 2: Test the full flow end-to-end**

1. Run `npm run extract-data` — verify JSON files generated
2. Run `npm run dev` — verify web app loads
3. Create a session — verify it persists
4. Check some locations — verify state saves
5. Assign items via popup — verify tier filtering works
6. Switch grouping modes — verify all three work
7. Export/import session — verify round-trip
8. Visit `?mode=overlay` — verify compact view

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: add CLAUDE.md and finalize v1 integration"
git push
```

---

## Task Dependency Graph

```
Task 0 (Scaffold) ← Task 1 (2DA Parser) ← Task 2 (ITM/TLK Reader) ← Task 3 (Extraction Script)
Task 0 ← Task 4 (Types & Store)
Task 3 + Task 4 ← Task 5 (Data Loader & Grouping)
Task 5 ← Task 6 (Layout & Header)
Task 6 ← Task 7 (Location List & Row)
Task 7 ← Task 8 (Item Popup)
Task 0 ← Task 9 (Electron Setup)
Task 8 + Task 9 ← Task 10 (Overlay View)
Task 10 ← Task 11 (Polish & Integration)
```

## Estimated Commit Count: 11-12
