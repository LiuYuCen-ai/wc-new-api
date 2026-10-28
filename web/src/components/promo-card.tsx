import { Link } from '@tanstack/react-router'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromoCardProps {
  icon: LucideIcon
  title: string
  description: string
  href?: string
  external?: boolean
  className?: string
}

export function PromoCard({
  icon: Icon,
  title,
  description,
  href,
  external,
  className,
}: PromoCardProps) {
  const content = (
    <>
      <div className='flex items-center justify-center gap-2'>
        <Icon className='size-5 shrink-0 stroke-[1.5]' aria-hidden />
        <h3 className='text-base font-semibold tracking-tight'>{title}</h3>
      </div>
      <p className='text-muted-foreground mt-3 text-sm leading-6'>{description}</p>
    </>
  )

  const cardClassName = cn(
    'flex min-h-[9.5rem] flex-col items-center justify-center rounded-2xl border border-border/70 bg-card px-5 py-6 text-center shadow-xs transition-colors',
    href && 'hover:border-foreground/15 hover:bg-muted/20',
    className
  )

  if (!href) {
    return <article className={cardClassName}>{content}</article>
  }

  if (external) {
    return (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(cardClassName, 'text-inherit no-underline')}
      >
        {content}
      </a>
    )
  }

  return (
    <Link to={href} className={cn(cardClassName, 'text-inherit no-underline')}>
      {content}
    </Link>
  )
}
