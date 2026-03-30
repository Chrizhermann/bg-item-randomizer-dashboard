import type { Item, Location, Region } from './types'
import itemsData from './data/items.json'
import locationsData from './data/locations.json'
import regionsData from './data/regions.json'
import groupsData from './data/groups.json'

export const items: Item[] = itemsData as Item[]
export const locations: Location[] = locationsData as Location[]
export const regions: Region[] = regionsData as Region[]
export const groups: Record<string, string[]> = groupsData as Record<
  string,
  string[]
>

// Indexes for fast lookup
export const itemById = new Map<string, Item>(items.map((i) => [i.id, i]))

export const itemsByTier = new Map<string, Item[]>()
for (const item of items) {
  const existing = itemsByTier.get(item.tier)
  if (existing) {
    existing.push(item)
  } else {
    itemsByTier.set(item.tier, [item])
  }
}

export const locationsByTier = new Map<string, Location[]>()
for (const loc of locations) {
  const existing = locationsByTier.get(loc.tier)
  if (existing) {
    existing.push(loc)
  } else {
    locationsByTier.set(loc.tier, [loc])
  }
}
