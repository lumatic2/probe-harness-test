// nav-user.tsx — dashboard-01 NavUser 그대로: 하단 사용자 메뉴(아바타·이름·메일·드롭다운).
import { BellIcon, CircleUserRoundIcon, EllipsisVerticalIcon, LogOutIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { navigate } from '@/lib/app-context'
import { ctx } from '@/lib/derive'
import { URGENT_OPEN_HASH } from '@/components/nav-main'

const user = ctx.d.app.user as { name: string; email: string; initials: string }

export function NavUser() {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg grayscale"><AvatarFallback className="rounded-lg text-foreground">{user.initials}</AvatarFallback></Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg"><AvatarFallback className="rounded-lg text-foreground">{user.initials}</AvatarFallback></Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => toast('내 정보', { description: `${user.name} · ${user.email}` })}><CircleUserRoundIcon />내 정보</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast(`${ctx.d.entity.ownerLabel} 변경`, { description: '가상 계정이라 바뀌지 않습니다' })}><UsersIcon />{ctx.d.entity.ownerLabel} 변경</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(URGENT_OPEN_HASH)}><BellIcon />알림</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => toast('로그아웃됨', { description: '가상 계정입니다' })}><LogOutIcon />로그아웃</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
