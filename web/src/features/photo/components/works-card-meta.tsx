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
  meta: string
}) {
  return (
    <div className='mt-1.5 flex items-center justify-between gap-2'>
      <div className='flex min-w-0 items-center gap-1.5'>
        <Avatar size='sm' className='size-4 after:hidden'>
          <AvatarFallback className='text-[9px] leading-none'>
            {props.authorInitials}
          </AvatarFallback>
        </Avatar>
        <span className='text-muted-foreground truncate text-[11px] leading-none'>
          {props.authorName}
        </span>
      </div>
      {props.meta ? (
        <span className='text-muted-foreground max-w-[45%] shrink-0 truncate text-right text-[11px] leading-none'>
          {props.meta}
        </span>
      ) : null}
    </div>
  )
}
