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
import { Activity, Sparkles, Workflow } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'

import { CinematicTransition } from './cinematic-transition'
import { WorkflowCanvas } from './workflow/workflow-canvas'

import './workflow-studio.css'

export function Studio() {
  const { t } = useTranslation()
  const [showIntro, setShowIntro] = useState(true)

  const dismissIntro = () => {
    setShowIntro(false)
  }

  return (
    <PublicLayout showMainContainer={false}>
      {showIntro ? (
        <div className='fixed inset-x-0 top-14 bottom-0 z-40'>
          <CinematicTransition onComplete={dismissIntro} />
        </div>
      ) : null}
      <PageTransition>
        <div className='studio-workspace flex h-svh w-full min-w-0 flex-col pt-14'>
          <header className='studio-header'>
            <div className='studio-brand-mark' aria-hidden='true'>
              <Workflow className='size-4' />
              <span />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex min-w-0 items-center gap-2.5'>
                <h1 className='truncate text-[15px] font-semibold tracking-tight'>
                  {t('Studio')}
                </h1>
                <span className='studio-mode-label'>VISUAL WORKFLOW</span>
              </div>
              <p className='studio-description truncate'>
                {t(
                  'Build a node workflow: connect loaders, model nodes, and preview outputs.'
                )}
              </p>
            </div>
            <div className='studio-ready-state' role='status'>
              <Activity className='size-3.5' aria-hidden='true' />
              <span>{t('Ready')}</span>
            </div>
            <Sparkles className='studio-header-sparkle' aria-hidden='true' />
          </header>

          <div className='studio-canvas-shell min-h-0 flex-1'>
            <WorkflowCanvas />
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
