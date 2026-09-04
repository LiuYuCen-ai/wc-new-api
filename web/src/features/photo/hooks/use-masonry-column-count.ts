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
import { useEffect, useState } from 'react'

import { masonryColumnCountForWidth } from '../lib/works-masonry'

export function useMasonryColumnCount(): number {
  const [count, setCount] = useState(() =>
    typeof window === 'undefined'
      ? 2
      : masonryColumnCountForWidth(window.innerWidth)
  )

  useEffect(() => {
    const media = [
      window.matchMedia('(min-width: 1024px)'),
      window.matchMedia('(min-width: 768px)'),
      window.matchMedia('(min-width: 640px)'),
    ]
    const sync = () => {
      setCount(masonryColumnCountForWidth(window.innerWidth))
    }
    sync()
    for (const query of media) {
      query.addEventListener('change', sync)
    }
    return () => {
      for (const query of media) {
        query.removeEventListener('change', sync)
      }
    }
  }, [])

  return count
}
