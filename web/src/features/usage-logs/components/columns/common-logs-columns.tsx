import type { ColumnDef } from '@tanstack/react-table'
import { GitBranch, Sparkles, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatPriceInDisplayCurrency } from '@/lib/currency'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ALL_VALUE } from '../../constants'
import type { UsageLog } from '../../data/schema'
import {
  formatModelName,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  parseLogOther,
  isViolationFeeLog,
  renderAuditContent,
} from '../../lib/format'
import {
  isDisplayableLogType,
  isTimingLogType,
  getLogTypeConfig,
  isPerCallBilling,
} from '../../lib/utils'
import {
  isResolutionBillingLog,
  isResolutionTokenBilling,
  resolveAppliedUnitPrice,
  resolveResolutionVideoInputTier,
  resolveBilledVideoTokens,
} from '../../lib/resolution-billing'
import { resolveVideoInputTier } from '../../lib/video-input-tier'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'
import { LogCostDisplay } from '../log-cost-display'
import { ModelBadge } from '../model-badge'
import { TimingMetricsCell, StreamTpsCell } from '../timing-metrics-cell'
import { useUsageLogsContext } from '../usage-logs-provider'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

/**
 * 本次计费命中的视频输入单价（原样，非美元换算值）：
 * 有视频输入优先取 video 档，否则取无视频基准档；未配置时返回 null。
 */
function resolveAppliedVideoInputPrice(other: LogOtherData): number | null {
  const prices = other.video_input_price
  if (!prices) return null
  const noVideo = prices.no_video ?? 0
  const video = prices.video ?? 0
  if (noVideo <= 0 && video <= 0) return null
  const isVideoTier = resolveVideoInputTier(other) === 'video'
  let applied = noVideo > 0 ? noVideo : video
  if (isVideoTier && video > 0) applied = video
  return applied > 0 ? applied : null
}

function formatRatioCompact(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '-'
  return ratio % 1 === 0
    ? String(ratio)
    : ratio.toFixed(4).replace(/\.?0+$/, '')
}

function getGroupRatio(other: LogOtherData | null): number | null {
  const userGroupRatio = other?.user_group_ratio
  if (
    userGroupRatio != null &&
    userGroupRatio !== -1 &&
    Number.isFinite(userGroupRatio)
  ) {
    return userGroupRatio
  }

  const groupRatio = other?.group_ratio
  if (groupRatio != null && groupRatio !== 1 && Number.isFinite(groupRatio)) {
    return groupRatio
  }

  return null
}

function buildDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  isAdmin: boolean
): DetailSegment[] {
  const segments = buildTypeDetailSegments(log, other, t)
  // Quota saturation is a rare, admin-only anomaly marker; surface it first
  // and in danger styling so it stands out on the related billing log. The
  // backend already strips admin_info for non-admins; gate on isAdmin too as
  // defense in depth so the marker never leaks if that changes.
  if (isAdmin && other?.admin_info?.quota_saturation) {
    return [{ text: t('Quota clamped'), danger: true }, ...segments]
  }
  return segments
}

function buildTypeDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string
): DetailSegment[] {
  // Audit (type=3) and login (type=7) logs: render localized content from the
  // structured op descriptor instead of the raw (English-fallback) content.
  if (log.type === 3 || log.type === 7) {
    const text = renderAuditContent(other, t)
    return text ? [{ text }] : []
  }

  if (log.type === 6) {
    return [{ text: t('Async task refund') }]
  }

  if (log.type !== 2) return []

  const isViolation = isViolationFeeLog(other)
  if (isViolation) {
    const segments: DetailSegment[] = []
    segments.push({ text: t('Violation Fee'), danger: true })
    if (other?.violation_fee_code) {
      segments.push({
        text: other.violation_fee_code,
        muted: true,
      })
    }
    segments.push({
      text: `${t('Fee')}: ${formatLogQuota(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  // 单价跟随系统显示币种（USD→$ / CNY→¥），不做美元换算。
  const formatPrice = (price: number) =>
    `${formatPriceInDisplayCurrency(price, priceOpts)}/M`
  const formatPriceCompact = (price: number) =>
    formatPriceInDisplayCurrency(price, priceOpts)
  const formatPriceList = (prices: string[], showUnit: boolean) => {
    const text = prices.join(' / ')
    return showUnit ? `${text}/M` : text
  }
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(other)
  if (isTieredExpr) {
    if (tieredSummary) {
      const baseEntries = tieredSummary.priceEntries
        .filter((entry) => ['inputPrice', 'outputPrice'].includes(entry.field))
        .map((entry) => formatPriceCompact(entry.price))
      if (baseEntries.length > 0) {
        const tierLabel = tieredSummary.tier.label || t('Default')
        segments.push({
          text: `${tierLabel} · ${formatPriceList(baseEntries, true)}`,
        })
      }

      const cacheEntries = tieredSummary.priceEntries
        .filter((entry) =>
          ['cacheReadPrice', 'cacheCreatePrice', 'cacheCreate1hPrice'].includes(
            entry.field
          )
        )
        .map((entry) => {
          return formatPriceCompact(entry.price)
        })
      if (cacheEntries.length > 0) {
        segments.push({
          text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
          muted: true,
        })
      }

      const otherEntries = tieredSummary.priceEntries
        .filter(
          (entry) =>
            ![
              'inputPrice',
              'outputPrice',
              'cacheReadPrice',
              'cacheCreatePrice',
              'cacheCreate1hPrice',
            ].includes(entry.field)
        )
        .map((entry) => `${t(entry.shortLabel)} ${formatPrice(entry.price)}`)
      if (otherEntries.length > 0) {
        segments.push({
          text: otherEntries.join(' · '),
          muted: true,
        })
      }
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${t('No matching results')}`,
        muted: true,
      })
    }
  } else if (isResolutionBillingLog(other)) {
    // 按分辨率计费（按秒 / 按 token）：`model_price` 是分辨率单价而非按次单价，
    // 必须按实扣口径展示——按 token 还要区分「无视频 / 有视频」档位。
    const applied = resolveAppliedUnitPrice(other)
    const isTokenBilling = isResolutionTokenBilling(other)
    const parts: string[] = []
    if (applied != null) {
      parts.push(
        isTokenBilling
          ? `${formatPriceCompact(applied)}/M`
          : `${formatPriceCompact(applied)}/s`
      )
    }
    if (other.resolution) {
      parts.push(other.resolution)
    }
    const tier = resolveResolutionVideoInputTier(other)
    if (tier) {
      parts.push(tier === 'video' ? t('With video') : t('No video'))
    }
    segments.push({
      text: [isTokenBilling ? t('By token') : t('By second'), ...parts].join(
        ' · '
      ),
    })
    // 差额结算行：与预扣行同为「按 token / 按秒」，需标出这是补扣还是退还，
    // 否则两行看起来完全一样却金额不同（费用列只显示差额）。
    if (other.pre_consumed_quota != null && other.actual_quota != null) {
      if (other.actual_quota > other.pre_consumed_quota) {
        segments.push({ text: t('Settlement top-up'), muted: true })
      } else if (other.actual_quota < other.pre_consumed_quota) {
        segments.push({ text: t('Settlement refund'), muted: true })
      }
    }
  } else {
    const modelPrice = other.model_price
    const isPerCall = isPerCallBilling(modelPrice)
    if (isPerCall && modelPrice != null) {
      const perCallParts = [formatPriceCompact(modelPrice)]
      if (other.resolution) {
        perCallParts.push(other.resolution)
      }
      segments.push({
        text: [t('Per-call'), ...perCallParts].join(' · '),
      })
    } else if (other.model_ratio != null) {
      // 配置了视频输入单价时直接显示本次命中的档位单价（原样，不再由 ratio 换算）。
      const inputPriceUSD =
        resolveAppliedVideoInputPrice(other) ?? other.model_ratio * 2.0
      const baseEntries = [formatPriceCompact(inputPriceUSD)]
      if (other.completion_ratio != null) {
        baseEntries.push(
          formatPriceCompact(inputPriceUSD * other.completion_ratio)
        )
      }
      if (other.resolution) {
        baseEntries.push(other.resolution)
      }
      segments.push({
        text: `${t('Standard')} · ${formatPriceList(baseEntries, true)}`,
      })

      if (hasAnyCacheTokens(other)) {
        const cacheEntries = [
          other.cache_ratio != null && other.cache_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_ratio)
            : null,
          other.cache_creation_ratio != null && other.cache_creation_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio)
            : null,
          other.cache_creation_ratio_1h != null &&
          other.cache_creation_ratio_1h !== 0
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio_1h)
            : null,
        ].filter(Boolean) as string[]

        if (cacheEntries.length > 0) {
          segments.push({
            text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
            muted: true,
          })
        }
      }
    } else {
      const userGroupRatio = other.user_group_ratio
      const groupRatio = other.group_ratio
      const isUserGroup =
        userGroupRatio != null &&
        Number.isFinite(userGroupRatio) &&
        userGroupRatio !== -1
      const effectiveRatio = isUserGroup ? userGroupRatio : groupRatio
      const ratioLabel = isUserGroup
        ? t('User Exclusive Ratio')
        : t('Group Ratio')

      if (effectiveRatio != null && Number.isFinite(effectiveRatio)) {
        segments.push({
          text: `${ratioLabel} ${formatRatioCompact(effectiveRatio)}x`,
        })
      }
    }
  }

  if (other.is_system_prompt_overwritten) {
    segments.push({
      text: t('System Prompt Override'),
      danger: true,
    })
  }

  return segments
}

export function useCommonLogsColumns(isAdmin: boolean): ColumnDef<UsageLog>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<UsageLog>[] = [
    {
      accessorKey: 'created_at',
      header: t('Time'),
      cell: ({ row }) => {
        const log = row.original
        const timestamp = row.getValue('created_at') as number
        const config = getLogTypeConfig(log.type)

        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='truncate font-mono text-xs tabular-nums'>
              {formatTimestampToDate(timestamp)}
            </span>
            <StatusBadge
              label={t(config.label)}
              variant={config.color as StatusBadgeProps['variant']}
              size='sm'
              copyable={false}
              className='-ml-1.5 !text-xs [&_span]:!text-xs'
            />
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        if (!Array.isArray(value) || value.length === 0) return true
        if (value.includes(LOG_TYPE_ALL_VALUE)) return true
        return value.includes(String(row.original.type))
      },
      enableHiding: false,
      size: 180,
    },
  ]

  if (isAdmin) {
    columns.push(
      {
        id: 'channel',
        header: t('Channel'),
        accessorFn: (row) => row.channel,
        cell: function ChannelCell({ row }) {
          const { sensitiveVisible, setAffinityTarget, setAffinityDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!isDisplayableLogType(log.type)) return null

          const other = parseLogOther(log.other)
          const affinity = other?.admin_info?.channel_affinity
          const rawUseChannel = other?.admin_info?.use_channel ?? []
          const useChannel = Array.isArray(rawUseChannel)
            ? rawUseChannel.map(String).filter(Boolean)
            : []
          const hasRetryChain = useChannel.length > 1
          const channelChain = hasRetryChain
            ? useChannel.join(' → ')
            : undefined
          const channelDisplay = log.channel_name
            ? `${log.channel_name} #${log.channel}`
            : `#${log.channel}`
          const channelIdDisplay = `#${log.channel}`
          const channelName = sensitiveVisible ? log.channel_name : '••••'
          const multiKeyIndex = other?.admin_info?.multi_key_index
          const showMultiKeyIndex =
            other?.admin_info?.is_multi_key === true &&
            typeof multiKeyIndex === 'number' &&
            Number.isFinite(multiKeyIndex)

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className='flex max-w-[160px] flex-col gap-0.5' />
                  }
                >
                  <div className='relative inline-flex w-fit items-center gap-1'>
                    <StatusBadge
                      label={channelIdDisplay}
                      autoColor={String(log.channel)}
                      copyText={String(log.channel)}
                      size='sm'
                      showDot={false}
                      className='font-mono'
                    />
                    {showMultiKeyIndex && (
                      <StatusBadge
                        label={String(multiKeyIndex)}
                        size='sm'
                        showDot={false}
                        copyable={false}
                        variant='neutral'
                        className='h-5 min-w-5 justify-center rounded-full px-1 font-mono text-xs'
                        aria-label={`${t('Key')} ${multiKeyIndex}`}
                      />
                    )}
                    {hasRetryChain && (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              type='button'
                              className='text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none'
                              aria-label={t('Retry Chain')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                        >
                          <GitBranch
                            className='size-3.5 text-amber-500'
                            aria-hidden='true'
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          side='top'
                          align='start'
                          className='w-64 text-xs'
                        >
                          <div className='flex flex-col gap-1'>
                            <p className='font-medium'>{t('Retry Chain')}</p>
                            <p className='text-muted-foreground font-mono break-all'>
                              {channelChain}
                            </p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {affinity && (
                      <button
                        type='button'
                        className='absolute -top-1 -right-1 leading-none text-amber-500'
                        onClick={(e) => {
                          e.stopPropagation()
                          setAffinityTarget({
                            rule_name: affinity.rule_name || '',
                            using_group:
                              affinity.using_group ||
                              affinity.selected_group ||
                              '',
                            key_hint: affinity.key_hint || '',
                            key_fp: affinity.key_fp || '',
                          })
                          setAffinityDialogOpen(true)
                        }}
                      >
                        <Sparkles className='size-3 fill-current' />
                      </button>
                    )}
                  </div>
                  {log.channel_name && (
                    <span className='text-muted-foreground/70 truncate [font-family:var(--font-body)] !text-xs'>
                      {channelName}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <div className='space-y-1'>
                    <p>
                      {sensitiveVisible ? channelDisplay : channelIdDisplay}
                    </p>
                    {channelChain && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Chain')}: {channelChain}
                      </p>
                    )}
                    {showMultiKeyIndex && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Key')}: {multiKeyIndex}
                      </p>
                    )}
                    {affinity && (
                      <div className='border-t pt-1 text-xs'>
                        <p className='font-medium'>{t('Channel Affinity')}</p>
                        <p>
                          {t('Rule')}: {affinity.rule_name || '-'}
                        </p>
                        <p>
                          {t('Group')}:{' '}
                          {sensitiveVisible
                            ? affinity.using_group ||
                              affinity.selected_group ||
                              '-'
                            : '••••'}
                        </p>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
      },
      {
        id: 'user',
        header: t('User'),
        accessorFn: (row) => row.username,
        cell: function UserCell({ row }) {
          const { sensitiveVisible, setSelectedUserId, setUserInfoDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!log.username) return null

          return (
            <button
              type='button'
              className='flex items-center gap-1.5 text-left'
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUserId(log.user_id)
                setUserInfoDialogOpen(true)
              }}
            >
              <Avatar className='ring-border/60 size-6 ring-1 max-sm:hidden'>
                <AvatarFallback
                  className={cn(
                    'text-[11px] font-semibold',
                    !sensitiveVisible && 'bg-muted text-muted-foreground'
                  )}
                  style={
                    sensitiveVisible
                      ? getUserAvatarStyle(log.username)
                      : undefined
                  }
                >
                  {sensitiveVisible ? getUserAvatarFallback(log.username) : '•'}
                </AvatarFallback>
              </Avatar>
              <TooltipProvider delay={300}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className='text-muted-foreground max-w-[100px] truncate text-sm hover:underline' />
                    }
                  >
                    {sensitiveVisible ? log.username : '••••'}
                  </TooltipTrigger>
                  {sensitiveVisible && log.username.length > 12 && (
                    <TooltipContent side='top'>{log.username}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </button>
          )
        },
      }
    )
  }

  columns.push({
    accessorKey: 'token_name',
    header: t('Token'),
    cell: function TokenNameCell({ row }) {
      const { sensitiveVisible } = useUsageLogsContext()
      const log = row.original
      if (!isDisplayableLogType(log.type)) return null

      const tokenName = log.token_name
      if (!tokenName) return null

      const other = parseLogOther(log.other)
      const displayName = sensitiveVisible ? tokenName : '••••'
      let group = log.group
      if (!group) group = other?.group || ''
      const groupRatio = getGroupRatio(other)

      return (
        <div className='flex max-w-[200px] flex-col gap-0.5'>
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger render={<div className='max-w-full' />}>
                <StatusBadge
                  label={displayName}
                  icon={KeyRound}
                  copyText={sensitiveVisible ? tokenName : undefined}
                  size='sm'
                  showDot={false}
                  className='border-border/60 bg-muted/30 text-foreground h-6 max-w-full gap-1.5 overflow-hidden rounded-md border px-2 py-0.5 [font-family:var(--font-body)]'
                />
              </TooltipTrigger>
              {sensitiveVisible && tokenName.length > 16 && (
                <TooltipContent side='top' className='max-w-xs break-all'>
                  {tokenName}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {(group || groupRatio != null) && (
            <span className='block max-w-full truncate text-xs leading-none'>
              {group ? (
                <GroupBadge
                  group={group}
                  label={sensitiveVisible ? undefined : '••••'}
                  type='text'
                  size='sm'
                  className='inline align-baseline text-xs leading-none [&>span]:leading-none'
                />
              ) : null}
              {group && groupRatio != null ? ' ' : null}
              {groupRatio != null ? (
                <span className='text-muted-foreground/60 relative top-px align-baseline tabular-nums'>
                  {formatRatioCompact(groupRatio)}x
                </span>
              ) : null}
            </span>
          )}
        </div>
      )
    },
    size: 160,
  })
  columns.push(
    {
      accessorKey: 'model_name',
      header: t('Model'),
      cell: function ModelCell({ row }) {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const modelInfo = formatModelName(log)

        return (
          <div className='flex w-fit flex-col gap-0.5'>
            <ModelBadge
              modelName={modelInfo.name}
              actualModel={modelInfo.actualModel}
            />
          </div>
        )
      },
      meta: { mobileTitle: true },
    },
    {
      accessorKey: 'is_stream',
      header: t('Stream'),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)
        const tokensPerSecond =
          useTime > 0 && log.completion_tokens > 0
            ? log.completion_tokens / useTime
            : null

        return (
          <StreamTpsCell
            isStream={log.is_stream}
            tokensPerSecond={tokensPerSecond}
            streamStatus={other?.stream_status}
          />
        )
      },
      meta: { label: t('Stream') },
    },
    {
      accessorKey: 'prompt_tokens',
      header: 'Tokens',
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const other = parseLogOther(log.other)

        const promptTokens = log.prompt_tokens || 0
        const completionTokens = log.completion_tokens || 0
        if (promptTokens === 0 && completionTokens === 0) {
          // 视频按 token 计费的任务没有 prompt/completion token：
          // 预扣行显示估算量（≈），结算行显示上游返回的真实 token 数。
          const videoTokens = resolveBilledVideoTokens(other)
          if (videoTokens) {
            return (
              <div className='flex flex-col gap-0.5'>
                <span className='font-mono text-xs font-medium tabular-nums'>
                  {videoTokens.estimated ? '≈' : ''}
                  {videoTokens.tokens.toLocaleString()}
                </span>
                <span className='text-muted-foreground/60 text-[11px]'>
                  {videoTokens.estimated
                    ? t('Estimated video tokens')
                    : t('Video tokens')}
                </span>
              </div>
            )
          }
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const cacheReadTokens = other?.cache_tokens || 0
        const cacheWrite5m = other?.cache_creation_tokens_5m || 0
        const cacheWrite1h = other?.cache_creation_tokens_1h || 0
        const hasSplitCache = cacheWrite5m > 0 || cacheWrite1h > 0
        const cacheWriteTokens = hasSplitCache
          ? cacheWrite5m + cacheWrite1h
          : other?.cache_creation_tokens || 0

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='font-mono text-xs font-medium tabular-nums'>
              {promptTokens.toLocaleString()} /{' '}
              {completionTokens.toLocaleString()}
            </span>
            {(cacheReadTokens > 0 || cacheWriteTokens > 0) && (
              <div className='flex items-center gap-1 text-[11px]'>
                {cacheReadTokens > 0 && (
                  <span className='text-muted-foreground/60'>
                    {t('Cache')}↓ {cacheReadTokens.toLocaleString()}
                  </span>
                )}
                {cacheWriteTokens > 0 && (
                  <span className='text-muted-foreground/60'>
                    ↑ {cacheWriteTokens.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'quota',
      header: t('Cost'),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const quota = row.getValue('quota') as number
        const other = parseLogOther(log.other)
        return <LogCostDisplay quota={quota} other={other} />
      },
    },

    {
      accessorKey: 'use_time',
      header: t('Timing'),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)

        return (
          <TimingMetricsCell
            useTimeSec={useTime}
            completionTokens={log.completion_tokens}
            frtMs={other?.frt}
            isStream={log.is_stream}
          />
        )
      },
    },

    {
      accessorKey: 'content',
      header: t('Details'),
      cell: function DetailsCell({ row }) {
        const [dialogOpen, setDialogOpen] = useState(false)
        const log = row.original
        const other = parseLogOther(log.other)

        const segments = buildDetailSegments(log, other, t, isAdmin)
        const primary = segments[0]
        const hasMore = segments.length > 1
        let primaryTextClass = 'text-foreground'
        if (primary?.muted) {
          primaryTextClass = 'text-muted-foreground/60'
        } else if (primary?.danger) {
          primaryTextClass = 'text-red-600 dark:text-red-400'
        }
        let detailPreview = <span className='text-muted-foreground/40'>—</span>
        if (primary) {
          detailPreview = (
            <span
              className={cn(
                'truncate leading-snug group-hover:underline',
                primaryTextClass
              )}
            >
              {primary.text}
              {hasMore && (
                <span className='text-muted-foreground/40 ml-0.5'>
                  +{segments.length - 1}
                </span>
              )}
            </span>
          )
        } else if (log.content) {
          detailPreview = (
            <span className='text-muted-foreground truncate group-hover:underline'>
              {log.content}
            </span>
          )
        }

        return (
          <>
            <button
              type='button'
              className='group flex max-w-[200px] items-center gap-1 text-left text-xs'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full details')}
            >
              {detailPreview}
            </button>
            <DetailsDialog
              log={log}
              isAdmin={isAdmin}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
      size: 180,
      maxSize: 200,
    }
  )

  return columns
}
