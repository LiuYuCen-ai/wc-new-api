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
