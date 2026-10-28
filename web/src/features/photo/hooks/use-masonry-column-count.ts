import { useEffect, useRef, useState } from 'react'

import { masonryColumnCountForWidth } from '../lib/works-masonry'

export function useMasonryColumnCount() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === 'undefined'
      ? 2
      : masonryColumnCountForWidth(window.innerWidth)
  )

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const sync = () => {
      setColumnCount(masonryColumnCountForWidth(node.clientWidth))
    }
    sync()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', sync)
      return () => window.removeEventListener('resize', sync)
    }

    const observer = new ResizeObserver(sync)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { containerRef, columnCount }
}
