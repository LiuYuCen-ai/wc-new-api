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
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const i18next = (await import('i18next')).default
const { initReactI18next } = await import('react-i18next')
await i18next.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Experience Hub': 'Experience Hub',
        'Image generation': 'Image generation',
        'Video generation': 'Video generation',
        Untitled: 'Untitled',
        Works: 'Works',
        'View video': 'View video',
        'Delete history': 'Delete history',
        '{{value}}s': '{{value}}s',
      },
    },
  },
})
const { PhotoModeRail } = await import('../components/photo-mode-rail')
const { VideoWorksCard } = await import('../components/video-works-card')
const {
  WorksFeedHeader,
  WorksLoadMoreSentinel,
  WorksMasonry,
} = await import('../components/works-masonry')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedRail = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderRail(
  mode: 'image' | 'video'
): Promise<RenderedRail> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <PhotoModeRail mode={mode} onModeChange={() => undefined} />
    )
  })
  return { container, root }
}

describe('photo mode rail', () => {
  test('shows image and video modes without GPT or Gemini tabs', async () => {
    const rendered = await renderRail('image')
    const labels = [...rendered.container.querySelectorAll('button')].map(
      (button) => button.textContent ?? ''
    )

    assert.ok(labels.some((label) => label.includes('Image generation')))
    assert.ok(labels.some((label) => label.includes('Video generation')))
    assert.equal(
      labels.some((label) => /\bGPT\b/i.test(label) || /Gemini/i.test(label)),
      false
    )

    const imageButton = [...rendered.container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Image generation')
    )
    assert.equal(imageButton?.getAttribute('aria-current'), 'page')

    await act(async () => {
      rendered.root.unmount()
    })
    rendered.container.remove()
  })
})

describe('video works card', () => {
  test('puts the title and author below a variable-height cover', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <VideoWorksCard
          item={{
            id: 'task_1',
            requestId: 'task_1',
            status: 'done',
            url: 'https://cdn.example.com/a.mp4',
            prompt: 'A lantern rising over an old town',
            model: 'MiniMax-H3',
            duration: '5',
            aspectRatio: '16:9',
            resolution: '768P',
            createdAt: 1,
          }}
          authorName='lucas'
          authorInitials='L'
          onOpen={() => undefined}
          onDelete={() => undefined}
        />
      )
    })

    assert.ok(
      container.textContent?.includes('A lantern rising over an old town')
    )
    assert.ok(container.textContent?.includes('lucas'))
    assert.ok(container.textContent?.includes('MiniMax-H3'))
    const openButton = container.querySelector('button[aria-label="View video"]')
    assert.ok(openButton)
    const cover = container.querySelector('[style*="aspect-ratio"]')
    assert.ok(cover)
    assert.equal(
      (cover as HTMLElement).style.aspectRatio.replaceAll(/\s/g, ''),
      '4/3'
    )
    assert.ok(cover.classList.contains('rounded-lg'))
    assert.ok(cover.textContent?.includes('00:05'))
    assert.ok(cover.textContent?.includes('MiniMax-H3'))
    const title = [...container.querySelectorAll('p')].find((node) =>
      node.textContent?.includes('A lantern rising over an old town')
    )
    assert.ok(title)
    assert.equal(cover.contains(title), false)
    assert.ok(title.classList.contains('line-clamp-2'))
    assert.ok(openButton.contains(cover))
    assert.ok(openButton.contains(title))

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})

describe('works feed header', () => {
  test('renders Works as a section heading', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<WorksFeedHeader />)
    })

    const heading = container.querySelector('h2')
    assert.equal(heading?.textContent, 'Works')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})

describe('works masonry', () => {
  test('arranges notes in a compact left-to-right column feed', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <WorksMasonry
          items={[{ id: 'a' }, { id: 'b' }]}
          getItemKey={(item) => item.id}
          getItemWeight={() => 1}
          renderItem={(item) => <p>{item.id}</p>}
        />
      )
    })

    const feed = container.firstElementChild as HTMLElement
    assert.equal(feed.classList.contains('flex'), true)
    assert.equal(feed.classList.contains('items-start'), true)
    assert.ok(feed.children.length >= 2)
    const firstColumn = feed.children[0] as HTMLElement
    assert.equal(firstColumn.classList.contains('flex-col'), true)

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})

describe('video works load more', () => {
  test('shows a spinner while older works are being fetched', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <WorksLoadMoreSentinel
          enabled={false}
          loading
          onLoadMore={() => undefined}
        />
      )
    })

    assert.ok(container.querySelector('svg'))

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})

after(() => {
  document.body.replaceChildren()
})
