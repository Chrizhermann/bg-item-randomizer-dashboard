export interface Item {
  id: string // "tier:token" composite key
  resref: string // e.g., "amul16"
  tier: string
  token: string
  displayName: string
  unidentifiedName: string
  originalSource: string
  comment: string
  game: 'bg1' | 'bg2'
}

export interface Location {
  id: string // "tier:location" composite key
  tier: string
  locationIndex: number
  target: string
  area: string
  comment: string
  targetType:
    | 'container'
    | 'creature'
    | 'group'
    | 'script'
    | 'store'
    | 'unknown'
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

export type GameFilter = 'all' | 'bg1' | 'bg2'

export interface LocationState {
  checked: boolean
  assignedItemId: string | null
  note: string
}

export interface SessionState {
  name: string
  createdAt: string
  locationStates: Record<string, LocationState>
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface OverlaySettings {
  keybinding: string
  monitorId: number
  overlayBounds?: Bounds
  mainBounds?: Bounds
}

export interface AppStore {
  settings: OverlaySettings
  sessions: Record<string, SessionState>
  activeSessionName: string | null
}

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> | null }
  : T
