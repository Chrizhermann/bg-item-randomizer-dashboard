/**
 * Deep merge source into target.
 * - Objects merge recursively
 * - null deletes the key
 * - Primitives and arrays replace entirely
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]

    if (sourceVal === null) {
      delete (result as Record<string, unknown>)[key]
      continue
    }

    const targetVal = (target as Record<string, unknown>)[key]

    if (
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      ;(result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      )
    } else {
      ;(result as Record<string, unknown>)[key] = sourceVal
    }
  }

  return result
}
