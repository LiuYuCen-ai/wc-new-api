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
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

interface ModelLogoMarqueeProps {
  className?: string
}

interface LogoItem {
  id: string
  iconName: string
  label: string
  size?: number
}

const logoItems: LogoItem[] = [
  { id: 'midjourney', iconName: 'Midjourney.Color', label: 'Midjourney' },
  { id: 'zhipu', iconName: 'Zhipu.Color', label: '智谱 AI' },
  { id: 'banana', iconName: 'NanoBanana.Color', label: 'Nano Banana' },
  { id: 'qwen', iconName: 'Qwen.Color', label: 'Qwen' },
  { id: 'flux', iconName: 'Flux.Color', label: 'FLUX' },
  { id: 'sora', iconName: 'Sora.Color', label: 'Sora' },
  { id: 'openai', iconName: 'OpenAI.Color', label: 'OpenAI' },
  { id: 'doubao', iconName: 'Doubao.Color', label: '豆包大模型' },
  { id: 'deepseek', iconName: 'DeepSeek.Color', label: 'DeepSeek' },
  { id: 'claude', iconName: 'Claude.Color', label: 'Claude' },
  { id: 'claude-code', iconName: 'ClaudeCode.Color', label: 'Claude Code' },
  { id: 'gemini', iconName: 'Gemini.Color', label: 'Gemini' },
  { id: 'vertex-ai', iconName: 'VertexAI.Color', label: 'Vertex AI' },
  { id: 'codex', iconName: 'Codex.Color', label: 'Codex' },
  { id: 'minimax', iconName: 'Minimax.Color', label: 'Minimax' },
  { id: 'grok', iconName: 'Grok.Color', label: 'Grok' },
  { id: 'kimi', iconName: 'Kimi', label: 'Kimi', size: 22 },
  { id: 'kling', iconName: 'Kling.Color', label: 'Kling' },
]

const marqueeItems = [...logoItems, ...logoItems]

function LogoGroup(props: { items: LogoItem[] }) {
  return (
    <div className='flex shrink-0 items-center gap-12 px-6 md:gap-16 md:px-8'>
      {props.items.map((item) => (
        <div
          key={item.id}
          className='flex shrink-0 items-center justify-center gap-2.5 text-[#7b7b7b]'
        >
          <span className='flex size-5 items-center justify-center [&_svg]:size-5'>
            {getLobeIcon(item.iconName, item.size ?? 20)}
          </span>
          <span className='whitespace-nowrap text-sm font-medium leading-none md:text-base'>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ModelLogoMarquee(props: ModelLogoMarqueeProps) {
  return (
    <section className={cn('overflow-hidden px-0 py-0', props.className)}>
      <div className='relative mx-auto w-full max-w-none overflow-hidden border-y border-black/8 bg-[#f7f7f5]'>
        <div className='pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#f7f7f5] via-[#f7f7f5]/95 to-transparent md:w-16' />
        <div className='pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#f7f7f5] via-[#f7f7f5]/95 to-transparent md:w-16' />

        <div className='flex w-max min-w-max items-center animate-model-logo-marquee-seamless py-3 will-change-transform md:py-3.5'>
          <LogoGroup items={marqueeItems} />
          <LogoGroup items={marqueeItems} />
        </div>
      </div>
    </section>
  )
}
