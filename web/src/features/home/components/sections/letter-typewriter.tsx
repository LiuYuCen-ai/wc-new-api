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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

const LETTER_PARAGRAPHS = [
  'What is truly hard is not calling a model once, but bringing model capabilities into real products in a stable, controllable, and billable way.',
  'WebChannel aims to bring complex provider integration, key management, routing policies, log tracing, and cost governance together into one clear entry point.',
  'You focus on building products; we make sure model capabilities arrive reliably.',
] as const

type LetterSegment = {
  kind: 'title' | 'paragraph' | 'signature'
  text: string
}

function TypewriterLine({
  as: Tag,
  fullText,
  visibleText,
  showCursor,
  className,
  visibleClassName,
}: {
  as: 'h2' | 'p'
  fullText: string
  visibleText: string
  showCursor: boolean
  className?: string
  visibleClassName?: string
}) {
  return (
    <div
      className={cn(
        'grid w-full max-w-2xl [&>*]:col-start-1 [&>*]:row-start-1',
        className
      )}
    >
      <Tag className={cn(visibleClassName, 'invisible')} aria-hidden>
        {fullText}
      </Tag>
      <Tag className={visibleClassName}>
        {visibleText}
        {showCursor ? <TypewriterCursor /> : null}
      </Tag>
    </div>
  )
}

function TypewriterCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'ml-0.5 inline-block w-[2px] animate-pulse bg-current align-middle',
        className
      )}
      style={{ height: '1.1em' }}
    />
  )
}

function useTypewriterSequence(
  lines: string[],
  options: {
    active: boolean
    instant: boolean
    charDelayMs?: number
    pauseMs?: number
  }
) {
  const { active, instant, charDelayMs = 32, pauseMs = 480 } = options
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    setLineIndex(0)
    setCharIndex(0)
  }, [lines])

  useEffect(() => {
    if (!active) return

    if (instant) {
      setLineIndex(lines.length)
      setCharIndex(0)
      return
    }

    if (lineIndex >= lines.length) return

    const currentLine = lines[lineIndex]
    if (charIndex < currentLine.length) {
      const timeout = window.setTimeout(() => {
        setCharIndex((current) => current + 1)
      }, charDelayMs)
      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => {
      setLineIndex((current) => current + 1)
      setCharIndex(0)
    }, pauseMs)
    return () => window.clearTimeout(timeout)
  }, [active, instant, lineIndex, charIndex, lines, charDelayMs, pauseMs])

  const getLineText = (index: number) => {
    if (index < lineIndex) return lines[index]
    if (index === lineIndex) return lines[index].slice(0, charIndex)
    return ''
  }

  const isTyping =
    active && !instant && lineIndex < lines.length && charIndex < lines[lineIndex].length

  return { lineIndex, getLineText, isTyping, isComplete: lineIndex >= lines.length }
}

export function LetterTypewriterBlock() {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const segments = useMemo<LetterSegment[]>(
    () => [
      {
        kind: 'title',
        text: t('To everyone building AI products'),
      },
      ...LETTER_PARAGRAPHS.map((paragraph) => ({
        kind: 'paragraph' as const,
        text: t(paragraph),
      })),
      {
        kind: 'signature',
        text: 'WebChannel Team',
      },
    ],
    // i18n.language keeps translated copy in sync when locale changes
    [t, i18n.language]
  )

  const lines = useMemo(() => segments.map((segment) => segment.text), [segments])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { lineIndex, getLineText, isTyping } = useTypewriterSequence(lines, {
    active,
    instant: shouldReduceMotion,
    charDelayMs: 28,
    pauseMs: 520,
  })

  return (
    <div
      ref={containerRef}
      className='relative flex flex-col items-center px-6 py-16 text-center sm:px-10 md:py-24'
    >
      {segments.map((segment, index) => {
        const text = getLineText(index)
        const showCursor = isTyping && index === lineIndex

        if (segment.kind === 'title') {
          return (
            <TypewriterLine
              key='title'
              as='h2'
              fullText={segment.text}
              visibleText={text}
              showCursor={showCursor}
              visibleClassName='text-3xl leading-tight font-bold tracking-tight text-white drop-shadow-md md:text-4xl'
            />
          )
        }

        if (segment.kind === 'paragraph') {
          return (
            <TypewriterLine
              key={`paragraph-${index}`}
              as='p'
              fullText={segment.text}
              visibleText={text}
              showCursor={showCursor}
              className={index === 1 ? 'mt-8' : 'mt-6'}
              visibleClassName='text-sm leading-7 text-slate-100/90 md:text-base'
            />
          )
        }

        return (
          <TypewriterLine
            key='signature'
            as='p'
            fullText={segment.text}
            visibleText={text}
            showCursor={showCursor}
            className='mt-9'
            visibleClassName='text-sm font-semibold text-white'
          />
        )
      })}
    </div>
  )
}
