import * as React from 'react'
import { CpuIcon, FileTextIcon, GraduationCapIcon, MicIcon, WrenchIcon } from 'lucide-react'
import { NavDocuments } from '@/components/nav-documents'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useApp } from '@/lib/app-context'
import { ctx } from '@/lib/derive'
import { NAV, PAGE_META } from '@/lib/pages'

const ICONS = { cpu: CpuIcon, file: FileTextIcon, graduation: GraduationCapIcon, mic: MicIcon, wrench: WrenchIcon } as Record<string, typeof CpuIcon>

// 사이드바 — dashboard-01 AppSidebar 와 같은 짜임: 머리(앱 이름) · NavMain · NavDocuments · NavSecondary · NavUser.
// 필터(기간·그룹)는 메뉴를 옮겨도 유지한다(link).
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { route, link } = useApp()
  const AppIcon = ICONS[ctx.d.app.icon] ?? CpuIcon
  const activePage = route.page === 'item' ? 'list' : route.page
  const items = NAV.flatMap((g) => g.pages).map(({ key, icon: Icon }) => ({ key, title: PAGE_META[key].name, url: link(key), icon: <Icon /> }))
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href={link('dashboard')}>
                <AppIcon className="size-5!" />
                <span className="text-base font-semibold">{ctx.d.app.name}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} activeKey={activePage} quickHref={link('form')} />
        <NavDocuments />
        <NavSecondary className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
