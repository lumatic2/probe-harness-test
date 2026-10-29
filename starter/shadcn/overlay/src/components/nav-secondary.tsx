// nav-secondary.tsx — dashboard-01 NavSecondary 그대로: 하단 보조 내비(설정·도움말·검색).
import * as React from 'react'
import { CircleHelpIcon, SearchIcon, Settings2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { navigate } from '@/lib/app-context'
import { ctx } from '@/lib/derive'

export function NavSecondary(props: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const search = () => {
    navigate('#/list')
    setTimeout(() => document.querySelector<HTMLInputElement>('input[type=search]')?.focus(), 80)
  }
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton onClick={() => toast('설정은 이 데모에 없습니다')}><Settings2Icon /><span>설정</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton onClick={() => toast(ctx.d.app.name, { description: ctx.d.app.help })}><CircleHelpIcon /><span>도움말</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton onClick={search}><SearchIcon /><span>검색</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
