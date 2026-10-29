// nav-documents.tsx — dashboard-01 NavDocuments 그대로: 문서 그룹 + 항목별 「…」 메뉴(열기·공유·삭제) + 더보기.
import * as React from 'react'
import { FileIcon, FolderIcon, MoreHorizontalIcon, ShareIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { navigate } from '@/lib/app-context'
import { ctx } from '@/lib/derive'

type Doc = { name: string; hash: string; icon: React.ReactNode }
// 메인 메뉴(대시보드·목록·리포트·위젯 모음 …)와 겹치는 항목은 두지 않는다 — 여기엔 문서로 열리는 고유 항목만
const BASE: Doc[] = [
  { name: ctx.d.report?.memoTitle || '인수인계 메모', hash: '#/report', icon: <FileIcon /> },
]
const EXTRA: Doc[] = []

export function NavDocuments() {
  const { isMobile } = useSidebar()
  const [removed, setRemoved] = React.useState<string[]>([])
  const [more, setMore] = React.useState(false)
  const shown = [...BASE, ...(more ? EXTRA : [])].filter((d) => !removed.includes(d.name))

  const share = async (d: Doc) => {
    const url = `${location.origin}/${d.hash}`
    try { await navigator.clipboard.writeText(url) } catch { /* 클립보드가 막혀도 알림은 띄운다 */ }
    toast.success('링크 복사됨', { description: d.name })
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>문서</SidebarGroupLabel>
      <SidebarMenu>
        {shown.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.hash}>{item.icon}<span>{item.name}</span></a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover className="rounded-sm data-[state=open]:bg-accent">
                  <MoreHorizontalIcon />
                  <span className="sr-only">{item.name} 메뉴</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-28 rounded-lg" side={isMobile ? 'bottom' : 'right'} align={isMobile ? 'end' : 'start'}>
                <DropdownMenuItem onSelect={() => navigate(item.hash)}><FolderIcon /><span>열기</span></DropdownMenuItem>
                <DropdownMenuItem onSelect={() => share(item)}><ShareIcon /><span>공유</span></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => { setRemoved((r) => [...r, item.name]); toast('목록에서 뺐습니다', { description: item.name }) }}><Trash2Icon /><span>삭제</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        {EXTRA.length ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70" onClick={() => setMore((m) => !m)}>
              <MoreHorizontalIcon className="text-sidebar-foreground/70" />
              <span>{more ? '접기' : '더보기'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}
