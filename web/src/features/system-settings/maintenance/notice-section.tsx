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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { CopyButton } from '@/components/copy-button'
import { JsonCodeEditor } from '@/components/json-code-editor'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const DEFAULT_NOTICE_CONTENT = JSON.stringify(
  [
    {
      template: 'promo',
      title: 'GPT-5.6已上线！现在特惠价格为',
      highlight: '3折',
      description: '注册赠送10万token！',
      align: 'center',
      verticalAlign: 'middle',
      highlightSize: 'xl',
      publishDate: '2026-07-18',
    },
  ],
  null,
  2
)

const DEFAULT_NOTICE_I18N_CONTENT = JSON.stringify(
  {
    zhCN: [
      {
        template: 'promo',
        title: 'GPT-5.6已上线！现在特惠价格为',
        highlight: '3折',
        description: '注册赠送10万token！',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    zhTW: [
      {
        template: 'promo',
        title: 'GPT-5.6 已上線！現在特惠價格為',
        highlight: '3折',
        description: '註冊即送 10 萬 token！',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    en: [
      {
        template: 'promo',
        title: 'GPT-5.6 is now live! Now special discount is',
        highlight: 'J30%',
        description: 'Register now and get 100K tokens!',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    ja: [
      {
        template: 'promo',
        title: 'GPT-5.6が公開されました！特別価格は今なら',
        highlight: '30%',
        description: '登録で10万トークンをプレゼント！',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    fr: [
      {
        template: 'promo',
        title: 'GPT-5.6 est disponible ! Prix spécial actuel :',
        highlight: '30 %',
        description: 'Inscrivez-vous et recevez 100K tokens !',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    ru: [
      {
        template: 'promo',
        title: 'GPT-5.6 уже доступна! Специальная цена сейчас —',
        highlight: '30%',
        description: 'Зарегистрируйтесь и получите 100 тыс. токенов!',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
    vi: [
      {
        template: 'promo',
        title: 'GPT-5.6 đã ra mắt! Ưu đãi đặc biệt hiện chỉ còn',
        highlight: '30%',
        description: 'Đăng ký nhận ngay 100K token!',
        align: 'center',
        verticalAlign: 'middle',
        highlightSize: 'xl',
        publishDate: '2026-07-18',
      },
    ],
  },
  null,
  2
)

const noticeSchema = z.object({
  Notice: z.string().optional(),
  NoticeI18nContent: z.string().optional(),
})

type NoticeFormValues = z.infer<typeof noticeSchema>

type NoticeSectionProps = {
  defaultValue: string
  i18nDefaultValue: string
}

export function NoticeSection({
  defaultValue,
  i18nDefaultValue,
}: NoticeSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      Notice: defaultValue ?? '',
      NoticeI18nContent: i18nDefaultValue ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      Notice: defaultValue ?? '',
      NoticeI18nContent: i18nDefaultValue ?? '',
    })
  }, [defaultValue, form, i18nDefaultValue])

  const onSubmit = async (values: NoticeFormValues) => {
    const updates = [
      ['Notice', values.Notice ?? '', defaultValue ?? ''],
      [
        'NoticeI18nContent',
        values.NoticeI18nContent ?? '',
        i18nDefaultValue ?? '',
      ],
    ] as const

    for (const [key, value, previousValue] of updates) {
      if (value === previousValue) continue

      await updateOption.mutateAsync({
        key,
        value,
      })
    }
  }

  return (
    <SettingsSection title={t('System Notice')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save notice'
          />
          <FormField
            control={form.control}
            name='Notice'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between gap-3'>
                  <FormLabel>{t('Announcement content')}</FormLabel>
                  <CopyButton value={field.value || DEFAULT_NOTICE_CONTENT} />
                </div>
                <FormControl>
                  <Textarea
                    rows={8}
                    placeholder={t(
                      'Planned maintenance on Friday at 22:00 UTC...'
                    )}
                    {...field}
                    value={field.value || DEFAULT_NOTICE_CONTENT}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='NoticeI18nContent'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between gap-3'>
                  <FormLabel>{t('Announcement content languages')}</FormLabel>
                  <CopyButton
                    value={field.value || DEFAULT_NOTICE_I18N_CONTENT}
                  />
                </div>
                <FormControl>
                  <JsonCodeEditor
                    value={field.value || DEFAULT_NOTICE_I18N_CONTENT}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Multilingual announcement JSON. The selected language uses the matching language key first.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
