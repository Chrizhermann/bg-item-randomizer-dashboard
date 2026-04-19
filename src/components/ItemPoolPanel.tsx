import { useMemo } from 'react'
import type { Item } from '../types'
import { itemsByTier } from '../data-loader'

interface ItemPoolPanelProps {
  tiers: string[]
  assignedItemIds: Set<string>
}

export default function ItemPoolPanel({
  tiers,
  assignedItemIds,
}: ItemPoolPanelProps) {
  const poolItems = useMemo(() => {
    const items: Item[] = []
    for (const tier of tiers) {
      const tierItems = itemsByTier.get(tier)
      if (tierItems) items.push(...tierItems)
    }
    return items
  }, [tiers])

  const assignedCount = useMemo(
    () => poolItems.filter((item) => assignedItemIds.has(item.id)).length,
    [poolItems, assignedItemIds],
  )

  return (
    <div className="px-4 py-3 bg-stone-850 border-b border-stone-700 bg-stone-900/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-stone-400">
          Item Pool
        </span>
        <span className="text-xs text-stone-500">
          {assignedCount}/{poolItems.length} assigned
        </span>
      </div>

      {poolItems.length === 0 ? (
        <p className="text-xs text-stone-500">No items in pool</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
          {poolItems.map((item) => {
            const isAssigned = assignedItemIds.has(item.id)
            return (
              <span
                key={item.id}
                className={`text-xs truncate ${
                  isAssigned
                    ? 'line-through text-stone-600'
                    : 'text-stone-300'
                }`}
                title={`${item.displayName || item.resref} (${item.resref})`}
              >
                {item.displayName || item.resref}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
