export function excludeHiddenPhotoHistory<T extends { id: string }>(
  items: T[],
  hiddenIds: Iterable<string>
): T[] {
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set(hiddenIds)
  if (hidden.size === 0) return items
  return items.filter((item) => !hidden.has(item.id))
}

export function uniqueHiddenIds(ids: Iterable<string>, limit: number): string[] {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique.slice(-limit)
}
