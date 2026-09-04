/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
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
