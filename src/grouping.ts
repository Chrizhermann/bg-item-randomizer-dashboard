import type { GroupBy, Location, LocationState, Region } from './types'
import { regions } from './data-loader'

export interface LocationGroup {
  id: string
  name: string
  sortOrder: number
  locations: Location[]
}

// --- Tier grouping helpers ---

const SCROLL_LEVEL_MAP: Record<string, number> = {
  sa: 1,
  sb: 2,
  sc: 3,
  sd: 4,
  se: 5,
}

function tierSortOrder(tier: string): number {
  // BG2 SoA: tiers 1-7 => sort 0-6
  const numTier = Number(tier)
  if (!Number.isNaN(numTier)) {
    if (numTier >= 1 && numTier <= 7) return numTier
    // BG2 ToB: tiers 10-13 => sort 10-13
    if (numTier >= 10 && numTier <= 13) return numTier
    // BG1: tiers 24-28 => sort 24-28
    // BG1 TotSC: tiers 29-31 => sort 29-31
    if (numTier >= 24 && numTier <= 31) return numTier
  }
  // BG2 Scrolls: s4-s9 => sort 100-105
  if (tier.startsWith('s') && tier.length === 2) {
    const scrollNum = Number(tier.slice(1))
    if (!Number.isNaN(scrollNum) && scrollNum >= 4 && scrollNum <= 9) {
      return 100 + (scrollNum - 4)
    }
  }
  // BG1 Scrolls: sa-se => sort 200-204
  if (tier in SCROLL_LEVEL_MAP) {
    return 200 + SCROLL_LEVEL_MAP[tier] - 1
  }
  // Special: fa => sort 300, ka => sort 301
  if (tier === 'fa') return 300
  if (tier === 'ka') return 301
  // Unknown tiers sort last
  return 999
}

function tierDisplayName(tier: string): string {
  const numTier = Number(tier)
  if (!Number.isNaN(numTier)) {
    if (numTier >= 1 && numTier <= 7) {
      const suffix =
        numTier === 1 ? ' (Early)' : numTier === 7 ? ' (Late)' : ''
      return `BG2 SoA \u2014 Tier ${numTier}${suffix}`
    }
    if (numTier >= 10 && numTier <= 13) {
      return `BG2 ToB \u2014 Tier ${numTier}`
    }
    if (numTier >= 29 && numTier <= 31) {
      return `BG1 TotSC \u2014 Tier ${numTier}`
    }
    if (numTier >= 24 && numTier <= 28) {
      const suffix =
        numTier === 24 ? ' (Early)' : numTier === 28 ? ' (Late)' : ''
      return `BG1 \u2014 Tier ${numTier}${suffix}`
    }
  }
  // BG2 Scrolls: s4-s9
  if (tier.startsWith('s') && tier.length === 2) {
    const scrollNum = Number(tier.slice(1))
    if (!Number.isNaN(scrollNum) && scrollNum >= 4 && scrollNum <= 9) {
      return `Scrolls \u2014 Level ${scrollNum}`
    }
  }
  // BG1 Scrolls: sa-se
  if (tier in SCROLL_LEVEL_MAP) {
    return `BG1 Scrolls \u2014 Level ${SCROLL_LEVEL_MAP[tier]}`
  }
  if (tier === 'fa') return 'Flail of Ages Heads'
  if (tier === 'ka') return 'Kangaxx Wards'
  return `Tier ${tier}`
}

function groupByTier(allLocations: Location[]): LocationGroup[] {
  const tierMap = new Map<string, Location[]>()

  for (const loc of allLocations) {
    const existing = tierMap.get(loc.tier)
    if (existing) {
      existing.push(loc)
    } else {
      tierMap.set(loc.tier, [loc])
    }
  }

  const groups: LocationGroup[] = []
  for (const [tier, locs] of tierMap) {
    groups.push({
      id: `tier-${tier}`,
      name: tierDisplayName(tier),
      sortOrder: tierSortOrder(tier),
      locations: locs,
    })
  }

  return groups.sort((a, b) => a.sortOrder - b.sortOrder)
}

// --- Area grouping helpers ---

interface CompiledRegion {
  region: Region
  regex: RegExp
}

let compiledRegions: CompiledRegion[] | null = null

function getCompiledRegions(): CompiledRegion[] {
  if (compiledRegions === null) {
    compiledRegions = regions.map((r) => ({
      region: r,
      regex: new RegExp(r.areaPattern),
    }))
  }
  return compiledRegions
}

function findRegionForLocation(loc: Location): Region | null {
  const compiled = getCompiledRegions()
  for (const { region, regex } of compiled) {
    if (loc.game === region.game && regex.test(loc.area)) {
      return region
    }
  }
  return null
}

function groupByArea(allLocations: Location[]): LocationGroup[] {
  const regionMap = new Map<string, { region: Region; locations: Location[] }>()

  for (const loc of allLocations) {
    const region = findRegionForLocation(loc)
    if (region) {
      const existing = regionMap.get(region.id)
      if (existing) {
        existing.locations.push(loc)
      } else {
        regionMap.set(region.id, { region, locations: [loc] })
      }
    }
  }

  const groups: LocationGroup[] = []
  for (const [, { region, locations }] of regionMap) {
    groups.push({
      id: `area-${region.id}`,
      name: region.name,
      sortOrder: region.sortOrder,
      locations,
    })
  }

  return groups.sort((a, b) => a.sortOrder - b.sortOrder)
}

// --- Status grouping helpers ---

function groupByStatus(
  allLocations: Location[],
  locationStates: Record<string, LocationState>,
): LocationGroup[] {
  const unchecked: Location[] = []
  const checked: Location[] = []

  for (const loc of allLocations) {
    const state = locationStates[loc.id]
    if (state?.checked) {
      checked.push(loc)
    } else {
      unchecked.push(loc)
    }
  }

  const groups: LocationGroup[] = []

  if (unchecked.length > 0) {
    groups.push({
      id: 'status-unchecked',
      name: 'Unchecked',
      sortOrder: 0,
      locations: unchecked,
    })
  }

  if (checked.length > 0) {
    groups.push({
      id: 'status-checked',
      name: 'Checked',
      sortOrder: 1,
      locations: checked,
    })
  }

  return groups
}

// --- Main export ---

export function groupLocations(
  allLocations: Location[],
  groupBy: GroupBy,
  locationStates: Record<string, LocationState>,
): LocationGroup[] {
  switch (groupBy) {
    case 'tier':
      return groupByTier(allLocations)
    case 'area':
      return groupByArea(allLocations)
    case 'status':
      return groupByStatus(allLocations, locationStates)
  }
}
