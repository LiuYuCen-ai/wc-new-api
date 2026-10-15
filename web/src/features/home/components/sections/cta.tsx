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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Sparkles } from 'lucide-react'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 bg-[#f7f7f5] px-5 pb-20 sm:px-6 md:pb-28'>
      <AnimateInView animation='scale-in'>
        <div className='mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#6d35f2] px-7 py-12 text-center text-white shadow-[0_28px_80px_rgba(109,53,242,0.28)] md:px-12 md:py-16'>
          <Sparkles className='mx-auto mb-5 size-7 text-white/80' />
          <h2 className='mx-auto max-w-3xl text-2xl leading-tight font-bold tracking-tight md:text-4xl'>
            用 WebChannel，把 AI 能力变成可运营的产品基础设施。
          </h2>
          <p className='mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/80 md:text-base'>
            统一接入、统一治理、统一观测，让团队从第一条 API 请求开始，就拥有面向生产的模型调用体验。
          </p>
          <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
            <Button
              className='group rounded-full bg-white px-5 text-[#5d2dd6] hover:bg-white/90'
              render={<Link to='/sign-up' />}
            >
              立即开始
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='rounded-full border-white/35 bg-transparent px-5 text-white hover:bg-white/12 hover:text-white'
              render={<Link to='/pricing' />}
            >
              查看模型价格
            </Button>
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
