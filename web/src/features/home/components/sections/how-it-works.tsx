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
import { BarChart3, PlugZap, Settings2 } from 'lucide-react'

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const steps = [
    {
      num: '1',
      title: '配置',
      desc: '添加上游模型渠道，设置 API 密钥、分组权限和团队额度。',
      icon: <Settings2 className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: '连接',
      desc: '通过 OpenAI compatible API 接入业务应用，快速切换多家模型。',
      icon: <PlugZap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: '监控',
      desc: '持续追踪请求日志、调用成本、渠道状态和团队使用趋势。',
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 bg-[#f7f7f5] px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mx-auto mb-16 max-w-xl text-center md:mb-20'>
          <p className='mb-3 text-xs font-bold tracking-[0.22em] text-orange-500 uppercase'>
            工作流程
          </p>
          <h2 className='text-3xl font-bold tracking-tight text-slate-950 md:text-4xl'>
            三步快速上手
          </h2>
          <p className='mt-4 text-sm leading-7 text-slate-600'>
            从配置到上线保持简单，把复杂的模型接入工作交给 WebChannel 处理。
          </p>
        </AnimateInView>

        <div className='grid gap-6 md:grid-cols-3'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex min-h-72 flex-col items-center rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]'
            >
              <div className='relative mb-8'>
                <div className='flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#fbfbfa] text-purple-700 shadow-sm'>
                  {step.icon}
                </div>
                <div className='absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-3 text-xl font-bold text-slate-950'>
                {step.title}
              </h3>
              <p className='max-w-[260px] text-sm leading-7 text-slate-600'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
