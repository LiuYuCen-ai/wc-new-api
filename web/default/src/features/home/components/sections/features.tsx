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
import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
  ArrowRight,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AnimateInView } from '@/components/animate-in-view'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getLobeIcon } from '@/lib/lobe-icon'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()
  const [contactOpen, setContactOpen] = useState(false)

  const features = [
    {
      id: 'fast',
      num: '01',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
      span: 'md:col-span-2',
      icon: <Zap className='size-4 text-blue-400' />,
      visual: (
        <div className='mt-4 grid grid-cols-3 gap-2'>
          {['OpenAI', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Llama'].map(
            (name) => (
              <div
                key={name}
                className='border-border/30 bg-muted/20 text-muted-foreground flex items-center justify-center rounded-lg border px-3 py-2 text-xs transition-colors duration-300 hover:border-blue-500/30 hover:bg-blue-500/5'
              >
                {name}
              </div>
            )
          )}
        </div>
      ),
    },
    {
      id: 'secure',
      num: '02',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      span: 'md:col-span-1',
      icon: <Shield className='size-4 text-emerald-400' />,
      visual: (
        <div className='mt-4 flex items-center justify-center'>
          <div className='relative'>
            <div className='flex size-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5'>
              <Shield
                className='size-7 text-emerald-500/70'
                strokeWidth={1.5}
              />
            </div>
            <div className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500'>
              <svg
                className='size-2.5 text-white'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={3}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='m4.5 12.75 6 6 9-13.5'
                />
              </svg>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'global',
      num: '03',
      title: t('Global Coverage'),
      desc: t('Multi-region deployment for stable global access'),
      span: 'md:col-span-1',
      icon: <Globe className='size-4 text-violet-400' />,
      visual: (
        <div className='mt-4 space-y-2'>
          {[t('Load Balancing'), t('Rate Limiting'), t('Cost Tracking')].map(
            (step, i) => (
              <div key={step} className='flex items-center gap-2'>
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    i === 1
                      ? 'border border-blue-500/30 bg-blue-500/20 text-blue-500'
                      : 'border-border/40 bg-muted text-muted-foreground border'
                  }`}
                >
                  {i + 1}
                </div>
                <div className='bg-border/40 h-px flex-1' />
                <span className='text-muted-foreground text-xs'>{step}</span>
              </div>
            )
          )}
        </div>
      ),
    },
    {
      id: 'developer',
      num: '04',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      span: 'md:col-span-2',
      icon: <Code className='size-4 text-amber-400' />,
      visual: (
        <div className='mt-4 flex items-center gap-3'>
          <div className='flex -space-x-2'>
            {['API', 'SDK', 'CLI', 'Docs'].map((n) => (
              <div
                key={n}
                className='border-background from-muted to-muted/60 text-muted-foreground flex size-8 items-center justify-center rounded-full border-2 bg-gradient-to-br text-[9px] font-bold'
              >
                {n}
              </div>
            ))}
          </div>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Code className='size-3.5 text-blue-500' />
            {t('Multi-protocol Compatible')}
          </div>
        </div>
      ),
    },
  ]

  const additionalFeatures = [
    {
      icon: <Gauge className='size-5' strokeWidth={1.5} />,
      title: t('High Performance'),
      desc: t('Support for high concurrency with automatic load balancing'),
    },
    {
      icon: <DollarSign className='size-5' strokeWidth={1.5} />,
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
    },
    {
      icon: <Users className='size-5' strokeWidth={1.5} />,
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
    },
    {
      icon: <HeartHandshake className='size-5' strokeWidth={1.5} />,
      title: t('Open Source'),
      desc: t('Community driven, self-hosted, and extensible'),
    },
  ]

  const logoRows = [
    [
      { id: 'openai', iconName: "OpenAI.Color", size: 54 },
      { id: 'claude', iconName: "Claude.Color", size: 54 },
      { id: 'gemini', iconName: "Gemini.Color", size: 54 },
      { id: 'deepseek', iconName: "DeepSeek.Color", size: 54 },
      { id: 'qwen', iconName: "Qwen.Color", size: 54 },
    ],
    [
      { id: 'zhipu', iconName: "Zhipu.Color", size: 50 },
      { id: 'doubao', iconName: "Doubao.Color", size: 56 },
      { id: 'grok', iconName: "Grok.Color", size: 52 },
      { id: 'minimax', iconName: "Minimax.Color", size: 52 },
    ],
    [
      { id: 'midjourney', iconName: "Midjourney.Color", size: 54 },
      { id: 'sora', iconName: "Sora.Color", size: 56 },
      { id: 'flux', iconName: "Flux.Color", size: 54 },
      { id: 'kimi', iconName: "Kimi", size: 50 },
    ],
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='relative left-1/2 z-20 mb-20 w-screen max-w-none -translate-x-1/2 pt-4'>
          <div className='w-full border-y border-slate-200/80 bg-white/75 px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-10 lg:px-16'>
            <div className='mb-10 max-w-2xl'>
              <p className='mb-3 text-sm font-bold tracking-widest text-purple-700 uppercase md:text-base'>
                {t('Advantages')}
              </p>
              <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
                {t('Built for enterprise scale')}
              </h2>
              <p className='text-muted-foreground mt-4 text-sm leading-relaxed md:text-base'>
                {t(
                  'WebChannel provides stable, efficient, and scalable model access capabilities to help teams quickly build AI applications for production environments.'
                )}
              </p>
              <div className='mt-6 flex flex-wrap gap-3'>
                <button
                  type='button'
                  onClick={() => setContactOpen(true)}
                  className='inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                >
                  {t('Contact support')}
                </button>
                <Link
                  to='/about'
                  className='inline-flex h-10 items-center justify-center rounded-md border border-slate-300/70 bg-white/45 px-5 text-sm font-medium transition-colors hover:bg-white/70'
                >
                  {t('Learn more')}
                </Link>
              </div>
            </div>

            <div className='grid gap-20 md:grid-cols-2'>
              <div className='rounded-2xl border border-slate-300/80 bg-white p-8 shadow-[0_14px_40px_rgba(15,23,42,0.08)]'>
                <h3 className='mb-6 text-2xl font-bold tracking-tight md:text-3xl'>
                  {t('Stable and agile')}
                </h3>
                <div className='mb-6 overflow-hidden rounded-xl border border-slate-300/80 bg-slate-100 shadow-inner'>
                  <img
                    src='/landing/work.png'
                    alt={t('Stable and agile')}
                  />
                </div>
                <ul className='space-y-3 text-sm font-semibold'>
                  <li className='flex items-start gap-3'>
                    <span className='mt-1.5 size-2 bg-slate-900' />
                    {t('Unified multi-model access')}
                  </li>
                  <li className='flex items-start gap-3'>
                    <span className='mt-1.5 size-2 bg-slate-900' />
                    {t('High-concurrency request scheduling')}
                  </li>
                  <li className='flex items-start gap-3'>
                    <span className='mt-1.5 size-2 bg-slate-900' />
                    {t('Fast adaptation for production scenarios')}
                  </li>
                </ul>
              </div>

              <div className='rounded-2xl border border-slate-300/80 bg-white p-8 shadow-[0_14px_40px_rgba(15,23,42,0.08)]'>
                <h3 className='mb-6 text-2xl font-bold tracking-tight md:text-3xl'>
                  {t('Professional support')}
                </h3>
                <div className='mb-6 overflow-hidden rounded-xl border border-slate-300/80 bg-slate-100 shadow-inner'>
                  <img
                    src='/landing/work2.png'
                    alt={t('Professional support')}
                  />
                </div>
                <div className='mb-5 flex items-start gap-3 text-sm font-semibold'>
                  <span className='mt-1.5 size-2 bg-slate-900' />
                  {t('Professional team provides stable support for you')}
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {t(
                    'From integration and deployment to model invocation and daily operations, WebChannel provides timely response and continuous support to help teams quickly solve issues and keep services running steadily.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </AnimateInView>

        <div className='relative left-1/2 mb-20 flex w-screen max-w-none -translate-x-1/2 flex-col items-center gap-24 px-6 sm:px-10 lg:px-16 xl:flex-row xl:justify-center xl:gap-40'>
          {/* Left card - Icon grid card */}
          <div className='relative isolate w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] 2xl:max-w-[600px]'>
            <div className='grid flex-1 grid-cols-5 gap-6 bg-slate-50/70 p-10 lg:gap-8 lg:p-14 2xl:p-16'>
              {logoRows.flat().map((item, index) => (
                <div
                  key={item.id}
                  className={`flex size-14 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:scale-110 lg:size-16 ${
                    index % 2 === 0 ? 'translate-y-3' : ''
                  }`}
                >
                  {getLobeIcon(item.iconName, Math.round(item.size * 0.62))}
                </div>
              ))}
            </div>

            <div className='border-t border-slate-200/80 bg-white p-8 lg:p-10 2xl:p-12'>
              <div className='space-y-4'>
                <h3 className='text-2xl font-bold leading-tight tracking-tight lg:text-3xl 2xl:text-4xl'>
                  {t('Explore multiple models')}
                </h3>
                <p className='text-muted-foreground text-base leading-relaxed lg:text-lg'>
                  {t(
                    'Access mainstream AI models in one place, switch between capabilities easily, and support conversations, creation, coding, and multimodal scenarios.'
                  )}
                </p>
              </div>
              <Link
                to='/pricing'
                className='text-primary hover:text-primary/80 mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors lg:text-base'
              >
                {t('Browse all')}
                <ArrowRight className='size-4' />
              </Link>
            </div>
          </div>

          {/* Right card - API key glass panel */}
          <div className='relative isolate w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] 2xl:max-w-[600px]'>
            <div className='flex flex-1 items-center justify-center bg-slate-50/70 p-10 lg:p-14 2xl:p-16'>
              <div className='w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]'>
                <div className='mb-5 flex items-center justify-between border-b border-slate-200/80 pb-4'>
                  <div className='space-y-2'>
                    <div className='h-2.5 w-24 rounded-full bg-slate-900/80' />
                    <div className='h-2 w-36 rounded-full bg-slate-200' />
                  </div>
                  <div className='rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700'>
                    API
                  </div>
                </div>
                <div className='space-y-3'>
                  {['sk-webchannel-********', 'OpenAI Compatible', 'Realtime Usage'].map(
                    (item) => (
                      <div
                        key={item}
                        className='flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3'
                      >
                        <span className='text-sm font-medium text-slate-700'>
                          {item}
                        </span>
                        <span className='size-2 rounded-full bg-emerald-500' />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className='border-t border-slate-200/80 bg-white p-8 lg:p-10 2xl:p-12'>
              <div className='space-y-4'>
                <h3 className='text-2xl font-bold leading-tight tracking-tight lg:text-3xl 2xl:text-4xl'>
                  {t('Get API keys quickly')}
                </h3>
                <p className='text-muted-foreground text-base leading-relaxed lg:text-lg'>
                  {t(
                    'Manage keys, models, and invocation capabilities in one place so teams can connect to WebChannel more securely and efficiently.'
                  )}
                </p>
              </div>
              <Link
                to='/keys'
                className='text-primary hover:text-primary/80 mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors lg:text-base'
              >
                {t('Get API key')}
                <ArrowRight className='size-4' />
              </Link>
            </div>
          </div>
        </div>

        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent className='min-h-48 sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>{t('Contact support')}</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Core Features')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Built for developers,')}
            <br />
            {t('designed for scale')}
          </h2>
        </AnimateInView>

        {/* Bento grid */}
        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`bg-background group hover:bg-muted/20 p-7 transition-colors duration-300 md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border/40 bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums'>
                  {f.num}
                </span>
                <h3 className='text-sm font-semibold'>{f.title}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {f.desc}
              </p>
              {f.visual}
            </AnimateInView>
          ))}
        </div>

        {/* Additional features row */}
        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 group-hover:text-foreground mb-3 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                {f.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold'>{f.title}</h3>
              <p className='text-muted-foreground max-w-[200px] text-xs leading-relaxed'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
