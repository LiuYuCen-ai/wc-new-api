import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function WorksCardMeta(props: {
  authorName: string
  authorInitials: string
}) {
  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <Avatar size='sm' className='size-5 after:hidden'>
        <AvatarFallback className='text-[9px] leading-none'>
          {props.authorInitials}
        </AvatarFallback>
      </Avatar>
      <span className='text-muted-foreground truncate text-xs leading-none'>
        {props.authorName}
      </span>
    </div>
  )
}

export function WorksCardCaption(props: {
  title: string
  authorName: string
  authorInitials: string
}) {
  return (
    <div className='mt-1.5 flex min-w-0 flex-col gap-1.5 px-0.5'>
      <p className='line-clamp-2 text-[13px] leading-snug font-medium'>
        {props.title}
      </p>
      <WorksCardMeta
        authorName={props.authorName}
        authorInitials={props.authorInitials}
      />
    </div>
  )
}
